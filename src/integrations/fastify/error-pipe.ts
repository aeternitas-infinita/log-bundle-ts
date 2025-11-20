import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type * as pino from "pino";
import { ZodError } from "zod";
import {
    createErrorData,
    getOriginalError,
    shouldSendToSentry,
    toHttpResponse,
    toLogObject,
} from "../../error/error-data.js";
import { isCustomError, type CustomError } from "../../error/error-helpers.js";
import { ErrorType, type ValidationError } from "../../error/error-types.js";
import { sendToSentry } from "../sentry/plugin.js";

export type ErrorPipeOptions = {
    /**
     * Whether to include error details in response in non-production environments
     * Default: false
     */
    includeErrorDetails?: boolean;

    /**
     * Environment (dev, local, production, etc.)
     */
    environment?: string;

    /**
     * Headers to redact from logs and Sentry
     * Default: ["authorization", "cookie", "x-api-key"]
     */
    redactHeaders?: string[];

    /**
     * Whether to capture request body in Sentry
     * Default: false (can contain sensitive data)
     */
    captureRequestBody?: boolean;
};

/**
 * Checks if an error is a Fastify validation error with Zod
 * This is the most reliable way to detect Zod validation errors from Fastify
 */
function isZodValidationError(error: unknown): error is FastifyError & ZodError {
    return error instanceof ZodError;
}

/**
 * Converts Zod validation errors to ValidationError format
 * Includes all available Zod error information while maintaining RFC 9457 format
 */
function parseZodErrors(zodError: ZodError): ValidationError[] {
    return zodError.issues.map((issue) => {
        // Copy all issue properties to meta (except path and message which are already in the main fields)
        const meta: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(issue)) {
            // Skip path and message as they're already in the ValidationError
            if (key !== "path" && key !== "message") {
                meta[key] = val;
            }
        }

        return {
            field: issue.path.length > 0 ? issue.path.join(".") : "root",
            message: issue.message,
            meta,
        };
    });
}

/**
 * Sanitizes headers by redacting sensitive ones
 * Optimized to avoid unnecessary object copies
 */
function sanitizeHeaders(headers: Record<string, unknown>, redactList: string[]): Record<string, unknown> {
    // Check if any headers need redacting first
    let needsRedaction = false;
    for (const header of redactList) {
        if (headers[header]) {
            needsRedaction = true;
            break;
        }
    }

    // If no redaction needed, return original object
    if (!needsRedaction) {
        return headers;
    }

    // Only create copy if redaction is needed
    const sanitized = { ...headers };
    for (const header of redactList) {
        if (sanitized[header]) {
            sanitized[header] = "[REDACTED]";
        }
    }
    return sanitized;
}

/**
 * Creates a centralized error pipe for Fastify that:
 * 1. Captures full request context
 * 2. Sends detailed errors to Sentry
 * 3. Logs structured error data
 * 4. Returns clean HTTP responses
 *
 * Handles both CustomError (from throwNotFound, etc.) and standard errors
 *
 * @example
 * ```typescript
 * const errorPipe = createErrorPipe(logger, {
 *     environment: process.env.NODE_ENV,
 *     includeErrorDetails: true,
 * });
 *
 * fastify.setErrorHandler(errorPipe);
 * ```
 */
export function createErrorPipe(logger: pino.Logger, options: ErrorPipeOptions = {}) {
    const {
        includeErrorDetails = false,
        environment,
        redactHeaders = ["authorization", "cookie", "x-api-key", "x-api-token"],
        captureRequestBody = false,
    } = options;

    const shouldIncludeDetails = includeErrorDetails || environment === "dev" || environment === "local";

    return async function errorPipe(
        error: FastifyError | CustomError | Error,
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        // Create child logger with request ID
        const requestLogger = logger.child({ req_id: request.id });

        // Extract error metadata
        let statusCode: number;
        let errorType: ErrorType;
        let context: Record<string, unknown> = {};
        let skipSentry = false;
        let validationErrors: ValidationError[] | undefined;

        // Check if this is a Zod validation error first
        if (isZodValidationError(error)) {
            // Fastify validation error with Zod
            statusCode = 422;
            errorType = ErrorType.VALIDATION;
            validationErrors = parseZodErrors(error);
            skipSentry = true; // Don't send validation errors to Sentry
        } else if (isCustomError(error)) {
            // CustomError from throwNotFound(), etc.
            // Use getStatusCode() to derive from errorType if not explicitly set
            statusCode = error.getStatusCode();
            errorType = error.errorType;
            context = error.context ?? {};
            skipSentry = error.skipSentry ?? false;
        } else if ("statusCode" in error && typeof error.statusCode === "number") {
            // FastifyError or error with statusCode
            statusCode = error.statusCode;
            errorType = statusCode >= 500 ? ErrorType.INTERNAL : ErrorType.BAD_INPUT;
        } else {
            // Unknown error
            statusCode = 500;
            errorType = ErrorType.INTERNAL;
        }

        // Build comprehensive request context
        const requestContext = {
            url: request.url,
            method: request.method,
            params: request.params,
            query: request.query,
            headers: sanitizeHeaders(request.headers as Record<string, unknown>, redactHeaders),
            ip: request.ip,
            userAgent: request.headers["user-agent"],
            ...(captureRequestBody && { body: request.body }),
        };

        // Create ErrorData for structured response
        const errorData = createErrorData(errorType, error.message, {
            public: validationErrors
                ? {
                      title: "Validation Error",
                      detail: "Request validation failed",
                      validationErrors,
                  }
                : undefined,
            internal: {
                cause: error, // Original error for Sentry
                context: {
                    ...context,
                    ...requestContext,
                },
            },
            httpStatus: statusCode,
            skipSentry,
        });

        // Log error with full context
        const isServerError = statusCode >= 500;
        if (isServerError) {
            requestLogger.error(
                {
                    ...toLogObject(errorData),
                    stack: error.stack,
                },
                "Server error occurred"
            );
        }

        // Send to Sentry if applicable
        if (shouldSendToSentry(errorData) && !skipSentry) {
            const originalError = getOriginalError(errorData) ?? error;
            sendToSentry(
                "error",
                {
                    err: originalError,
                    ...toLogObject(errorData),
                },
                error.message,
                {
                    captureContext: true,
                    tags: {
                        error_type: errorType,
                        status_code: statusCode.toString(),
                        path: request.url,
                        method: request.method,
                        request_id: request.id,
                    },
                }
            );
        }

        // Convert to HTTP response
        const { statusCode: httpStatus, body } = toHttpResponse(errorData, {
            includeErrorDetails: shouldIncludeDetails,
        });

        await reply.code(httpStatus).send(body);
    };
}
