import * as Sentry from "@sentry/node";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type * as pino from "pino";
import { isSentryInitialized } from "../sentry/plugin.js";

export type FastifyErrorHandlerOptions = {
    /**
     * Whether to include error details in response in non-production environments
     * Default: false
     */
    includeErrorDetails?: boolean;

    /**
     * Environment (dev, local, production, etc.)
     * Used to determine if error details should be included
     */
    environment?: string;

    /**
     * Headers to redact from logs
     * Default: ["authorization", "cookie"]
     */
    redactHeaders?: string[];

    /**
     * Custom error status codes for specific error types
     */
    customStatusCodes?: Record<string, number>;
}

/**
 * Creates a Fastify error handler that logs errors and sends them to Sentry
 * @param logger - Pino logger instance
 * @param options - Configuration options
 * @returns Fastify error handler function
 */
export function createFastifyErrorHandler(logger: pino.Logger, options: FastifyErrorHandlerOptions = {}) {
    const { includeErrorDetails = false, environment, redactHeaders = ["authorization", "cookie"], customStatusCodes = {} } = options;

    return async function (error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<void> {
        // Create child logger with request ID
        const requestLogger = logger.child({ req_id: request.id });

        // Extract status code from error
        const statusCode = error.statusCode ?? customStatusCodes[error.constructor?.name] ?? 500;
        const isServerError = statusCode >= 500;
        const isClientError = statusCode >= 400 && statusCode < 500;

        // Log request context for debugging
        const requestContext = {
            url: request.url,
            method: request.method,
            statusCode,
            errorType: error.constructor?.name ?? "UnknownError",
        };

        // Redact sensitive headers (optimized to avoid unnecessary copies)
        let needsRedaction = false;
        for (const header of redactHeaders) {
            if (request.headers[header]) {
                needsRedaction = true;
                break;
            }
        }

        const redactedHeaders = needsRedaction ? { ...request.headers } : request.headers;
        if (needsRedaction) {
            for (const header of redactHeaders) {
                if (redactedHeaders[header]) {
                    redactedHeaders[header] = "[REDACTED]";
                }
            }
        }

        // Handle server errors (5xx) - these are critical and go to Sentry
        if (isServerError) {
            const finalStatusCode = statusCode;

            // Log full error details
            requestLogger.error(
                {
                    ...requestContext,
                    statusCode: finalStatusCode,
                    body: request.body,
                    query: request.query,
                    params: request.params,
                    headers: redactedHeaders,
                },
                "Unhandled server error"
            );

            requestLogger.error(error, "Error stack trace");

            // Capture in Sentry for monitoring (if enabled)
            if (isSentryInitialized()) {
                Sentry.captureException(error, {
                    level: "error",
                    contexts: {
                        request: {
                            url: request.url,
                            method: request.method,
                            query_string: request.query,
                            data: request.body,
                            headers: redactedHeaders,
                        },
                    },
                    tags: {
                        error_type: error.constructor?.name ?? "UnknownError",
                        status_code: finalStatusCode.toString(),
                        request_id: request.id,
                    },
                });
            }

            const shouldIncludeDetails = includeErrorDetails || environment === "dev" || environment === "local";

            await reply.code(finalStatusCode).send({
                message: "Oops, something went wrong",
                ...(shouldIncludeDetails && { error: error.message }),
            });
            return;
        }

        // Handle client errors (4xx) - log as warning, no Sentry
        if (isClientError) {
            requestLogger.warn(requestContext, "Client error");

            await reply.code(statusCode).send({
                message: error.message || "Bad request",
            });
            return;
        }

        // Fallback for any unexpected error format
        requestLogger.error({ ...requestContext, err: error }, "Unexpected error format");

        if (isSentryInitialized()) {
            Sentry.captureException(error, {
                level: "error",
                tags: {
                    error_type: "UnexpectedFormat",
                    request_id: request.id,
                },
            });
        }

        await reply.code(500).send({
            message: "Oops, something went wrong",
        });
    };
}
