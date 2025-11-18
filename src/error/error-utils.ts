/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ErrorData } from "./error-data.js";
import { getHttpStatus, shouldSendToSentry } from "./error-data.js";

/**
 * Type guard to check if a value is an ErrorData object
 *
 * @example
 * ```typescript
 * const result = await someOperation();
 * if (isErrorData(result)) {
 *   // Handle error with your custom format
 *   return customErrorFormatter(result);
 * }
 * return result;
 * ```
 */
export function isErrorData(value: unknown): value is ErrorData {
    return (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        "message" in value &&
        typeof (value as any).type === "string" &&
        typeof (value as any).message === "string"
    );
}

/**
 * Extract all error information from ErrorData as a plain object
 * Useful for projects that need raw error data without any formatting
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId);
 * const raw = extractErrorData(error);
 * // Returns: { type: "NOT_FOUND", message: "user not found", statusCode: 404, ... }
 *
 * // Use in your custom response formatter
 * return {
 *   success: false,
 *   error_code: raw.type,
 *   error_message: raw.message,
 *   status: raw.statusCode
 * };
 * ```
 */
export function extractErrorData(error: ErrorData): {
    type: string;
    message: string;
    statusCode: number;
    title?: string;
    detail?: string;
    context?: Record<string, unknown>;
    validationErrors?: { field?: string; message: string }[];
    shouldSendToSentry: boolean;
} {
    return {
        type: error.type,
        message: error.message,
        statusCode: getHttpStatus(error),
        title: error.public?.title,
        detail: error.public?.detail,
        context: error.internal?.context,
        validationErrors: error.public?.validationErrors,
        shouldSendToSentry: shouldSendToSentry(error),
    };
}

/**
 * Get only essential error fields (type, message, status)
 * Minimal error information for basic error handling
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId);
 * const essential = getEssentialErrorData(error);
 * // Returns: { type: "NOT_FOUND", message: "user not found", statusCode: 404 }
 * ```
 */
export function getEssentialErrorData(error: ErrorData): {
    type: string;
    message: string;
    statusCode: number;
} {
    return {
        type: error.type,
        message: error.message,
        statusCode: getHttpStatus(error),
    };
}

/**
 * Get error context metadata only (internal context for debugging)
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId, {
 *   internal: { context: { requestId: "123", url: "/api/users/456" } }
 * });
 * const context = getErrorContext(error);
 * // Returns: { resource: "user", resource_id: "456", requestId: "123", url: "/api/users/456" }
 * ```
 */
export function getErrorContext(error: ErrorData): Record<string, unknown> | undefined {
    return error.internal?.context;
}

/**
 * Get validation errors from ErrorData
 *
 * @example
 * ```typescript
 * const error = validation("Invalid email", "email");
 * const validationErrors = getValidationErrors(error);
 * // Returns: [{ field: "email", message: "Invalid email" }]
 * ```
 */
export function getValidationErrors(error: ErrorData): { field?: string; message: string }[] | undefined {
    return error.public?.validationErrors;
}

/**
 * Check if error is of a specific type
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId);
 * if (isErrorType(error, "NOT_FOUND")) {
 *   // Handle 404 specifically
 * }
 * ```
 */
export function isErrorType(error: ErrorData, type: string): boolean {
    return error.type === (type as any);
}

/**
 * Check if error is a client error (4xx)
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId);
 * if (isClientError(error)) {
 *   // Don't send to Sentry
 * }
 * ```
 */
export function isClientError(error: ErrorData): boolean {
    const status = getHttpStatus(error);
    return status >= 400 && status < 500;
}

/**
 * Check if error is a server error (5xx)
 *
 * @example
 * ```typescript
 * const error = internal("Database connection failed");
 * if (isServerError(error)) {
 *   // Log to Sentry
 *   logger.errorWithSentry({ err: error }, "Server error occurred");
 * }
 * ```
 */
export function isServerError(error: ErrorData): boolean {
    const status = getHttpStatus(error);
    return status >= 500;
}

/**
 * Merge additional context into an ErrorData object (internal context)
 * Returns a new ErrorData object with merged internal context
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId);
 * const enriched = withContext(error, { requestId: "123", url: "/api/users" });
 * // Error now includes requestId and url in internal context
 * ```
 */
export function withContext(error: ErrorData, additionalContext: Record<string, unknown>): ErrorData {
    return {
        ...error,
        internal: {
            ...error.internal,
            context: {
                ...error.internal?.context,
                ...additionalContext,
            },
        },
    };
}

/**
 * Override HTTP status code for an ErrorData object
 * Returns a new ErrorData object with custom status
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId);
 * const customError = withHttpStatus(error, 410); // Gone instead of Not Found
 * ```
 */
export function withHttpStatus(error: ErrorData, statusCode: number): ErrorData {
    return {
        ...error,
        httpStatus: statusCode,
    };
}

/**
 * Mark error to skip Sentry reporting
 * Returns a new ErrorData object that won't be sent to Sentry
 *
 * @example
 * ```typescript
 * const error = notFound("user", userId);
 * const noSentry = withoutSentry(error);
 * // This error won't trigger Sentry alerts
 * ```
 */
export function withoutSentry(error: ErrorData): ErrorData {
    return {
        ...error,
        skipSentry: true,
    };
}
