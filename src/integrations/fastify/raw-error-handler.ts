/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type * as pino from "pino";
import type { ErrorData } from "../../error/error-data.js";
import { extractErrorData, isErrorData } from "../../error/error-utils.js";
import { isCustomError } from "../../error/error-helpers.js";

export type RawErrorHandlerOptions = {
    /**
     * Whether to send errors to Sentry
     * @default false
     */
    sendToSentry?: boolean;

    /**
     * Filter which errors should be sent to Sentry
     * @default undefined (all errors if sendToSentry is true)
     */
    sendToSentryFilter?: (error: any, errorData: ErrorData | null) => boolean;

    /**
     * Custom error formatter - transform ErrorData to your custom response format
     * This is where you implement your legacy response format
     *
     * @param error - Original error (FastifyError, CustomError, or any)
     * @param errorData - Extracted ErrorData (if available)
     * @param request - Fastify request
     * @returns Your custom response object and optional status code override
     *
     * @example
     * ```typescript
     * formatError: (error, errorData) => {
     *   if (errorData) {
     *     return {
     *       body: {
     *         success: false,
     *         error_code: errorData.type,
     *         error_message: errorData.message,
     *         data: errorData.context
     *       },
     *       statusCode: errorData.statusCode
     *     };
     *   }
     *   return {
     *     body: { success: false, error_message: error.message },
     *     statusCode: 500
     *   };
     * }
     * ```
     */
    formatError: (
        error: any,
        errorData: {
            type: string;
            message: string;
            statusCode: number;
            title?: string;
            detail?: string;
            context?: Record<string, unknown>;
            validationErrors?: { field?: string; message: string }[];
            shouldSendToSentry: boolean;
        } | null,
        request: FastifyRequest
    ) => {
        body: any;
        statusCode?: number;
    };

    /**
     * Hook called before error is logged and sent
     * Useful for custom logging or metrics
     */
    onError?: (error: any, errorData: ErrorData | null, request: FastifyRequest) => void | Promise<void>;
};

/**
 * Creates a Fastify error handler that gives full control over error response formatting
 * Perfect for legacy projects with existing error response formats
 *
 * This handler:
 * - Extracts ErrorData from CustomError or ErrorData objects
 * - Calls your custom formatError function to create the response
 * - Logs errors with request context
 * - Optionally sends to Sentry based on your filter
 *
 * @example
 * ```typescript
 * // Legacy project with custom error format
 * const errorHandler = createRawFastifyErrorHandler(logger, {
 *   formatError: (error, errorData) => {
 *     if (errorData) {
 *       // Transform ErrorData to your legacy format
 *       return {
 *         body: {
 *           success: false,
 *           error_code: errorData.type,
 *           message: errorData.message,
 *           status_code: errorData.statusCode,
 *           meta: errorData.context
 *         }
 *       };
 *     }
 *     // Handle unknown errors
 *     return {
 *       body: {
 *         success: false,
 *         error_code: "INTERNAL_ERROR",
 *         message: "An unexpected error occurred"
 *       },
 *       statusCode: 500
 *     };
 *   },
 *   sendToSentry: true,
 *   sendToSentryFilter: (error, errorData) => {
 *     // Only send server errors (5xx) to Sentry
 *     return errorData ? errorData.statusCode >= 500 : true;
 *   }
 * });
 *
 * app.setErrorHandler(errorHandler);
 * ```
 */
export function createRawFastifyErrorHandler(
    logger: pino.Logger,
    options: RawErrorHandlerOptions
): (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => Promise<void> {
    const { sendToSentry = false, sendToSentryFilter, formatError, onError } = options;

    return async function rawErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
        const requestLogger = logger.child({ req_id: request.id });

        // Extract ErrorData if available
        let errorData: ErrorData | null = null;

        if (isCustomError(error)) {
            // Error is CustomError - convert to ErrorData
            const { createErrorData } = await import("../../error/error-data.js");
            errorData = createErrorData(error.errorType, error.message, {
                internal: {
                    context: error.context,
                },
                skipSentry: error.skipSentry,
                httpStatus: error.getStatusCode(),
            });
        } else if (isErrorData(error)) {
            // Error is ErrorData directly
            errorData = error;
        }

        // Extract error information
        const extractedData = errorData ? extractErrorData(errorData) : null;

        // Call custom onError hook
        if (onError) {
            try {
                await onError(error, errorData, request);
            } catch (hookError) {
                requestLogger.error({ err: hookError }, "Error in onError hook");
            }
        }

        // Log the error
        const logLevel = extractedData && extractedData.statusCode < 500 ? "warn" : "error";
        requestLogger[logLevel](
            {
                err: error,
                errorData: extractedData,
                url: request.url,
                method: request.method,
            },
            "Request error"
        );

        // Send to Sentry if enabled
        if (sendToSentry) {
            const shouldSend = sendToSentryFilter ? sendToSentryFilter(error, errorData) : true;

            if (shouldSend && (extractedData?.shouldSendToSentry ?? true)) {
                // Import Sentry dynamically to avoid circular dependencies
                try {
                    const { sendToSentry: sentryPlugin } = await import("../../integrations/sentry/plugin.js");
                    sentryPlugin(
                        "error",
                        {
                            err: error,
                            errorData: extractedData,
                            url: request.url,
                            method: request.method,
                            requestId: request.id,
                        },
                        error.message
                    );
                } catch (sentryError) {
                    requestLogger.error({ err: sentryError }, "Failed to send error to Sentry");
                }
            }
        }

        // Format error with custom formatter
        const { body, statusCode } = formatError(error, extractedData, request);

        // Determine final status code
        const finalStatusCode = statusCode ?? extractedData?.statusCode ?? error.statusCode ?? 500;

        // Send response
        await reply.status(finalStatusCode).send(body);
    };
}
