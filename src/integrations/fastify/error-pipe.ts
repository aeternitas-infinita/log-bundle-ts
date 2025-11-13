import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type * as pino from "pino";
import { sendToSentry } from "../sentry/plugin.js";
import { createErrorData, shouldSendToSentry, toHttpResponse, toLogObject } from "../../error/error-data.js";
import { ErrorType } from "../../error/error-types.js";
import { isHttpError, type HttpError } from "../../error/error-helpers.js";

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
}

/**
 * Sanitizes headers by redacting sensitive ones
 */
function sanitizeHeaders(headers: Record<string, unknown>, redactList: string[]): Record<string, unknown> {
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
 * Handles both HttpError (from throwNotFound, etc.) and standard errors
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

    return async function errorPipe(error: FastifyError | HttpError | Error, request: FastifyRequest, reply: FastifyReply): Promise<void> {
        // Create child logger with request ID
        const requestLogger = logger.child({ req_id: request.id });

        // Extract error metadata
        let statusCode: number;
        let errorType: ErrorType;
        let context: Record<string, unknown> = {};
        let skipSentry = false;

        if (isHttpError(error)) {
            // HttpError from throwNotFound(), etc.
            statusCode = error.statusCode;
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
            context: {
                ...context,
                ...requestContext,
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
        } else {
            requestLogger.warn(toLogObject(errorData), "Client error occurred");
        }

        // Send to Sentry if applicable
        if (shouldSendToSentry(errorData) && !skipSentry) {
            sendToSentry(
                "error",
                {
                    err: error,
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
