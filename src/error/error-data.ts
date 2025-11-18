import type { ErrorResponse, ValidationError } from "./error-types.js";
import { DEFAULT_HTTP_STATUS_MAP, type ErrorType } from "./error-types.js";
import { errorConfig } from "./error-config.js";

/**
 * Public error data - shown to end users via HTTP responses (RFC 9457 compliant)
 */
export type PublicErrorData = {
    /** RFC 9457: problem type identifier (defaults to "urn:problem:{error-type}" or custom string/URL) */
    type?: string;
    /** RFC 9457: short human-readable summary */
    title?: string;
    /** RFC 9457: human-readable explanation specific to this occurrence */
    detail?: string;
    /** RFC 9457: URI reference to this specific error occurrence */
    instance?: string;
    /** RFC 9457 extension: additional public metadata safe to expose to users */
    meta?: Record<string, unknown>;
    /** Extension: validation errors for input fields */
    validationErrors?: ValidationError[];
};

/**
 * Internal error data - only for logs and Sentry, never sent to users
 */
export type InternalErrorData = {
    /** Original error with full stack trace (for Sentry) */
    cause?: Error;
    /** Debug context for developers (query params, internal state, etc.) */
    context?: Record<string, unknown>;
    /** Custom tags for Sentry categorization */
    tags?: Record<string, string>;
};

/**
 * ErrorData represents a lightweight error object for logging and HTTP responses
 * This is a plain object, NOT an Error class - it cannot be thrown
 *
 * Clearly separates:
 * - Public data: safe to send to end users (RFC 9457 compliant)
 * - Internal data: only for logs/Sentry, never exposed to users
 */
export type ErrorData = {
    /** Error type determining HTTP status and categorization (internal) */
    readonly type: ErrorType;
    /** Internal message for logs (not sent to users unless in public.detail) */
    readonly message: string;

    /** Public data - sent to users via HTTP response */
    readonly public?: PublicErrorData;

    /** Internal data - only for logs and Sentry, never sent to users */
    readonly internal?: InternalErrorData;

    /** HTTP status code override (uses type default if not specified) */
    readonly httpStatus?: number;
    /** Skip Sentry reporting for this error */
    readonly skipSentry?: boolean;
};

/**
 * Options for creating ErrorData with explicit public/internal separation
 */
export type CreateErrorDataOptions = {
    /** Public data safe to show to end users */
    public?: PublicErrorData;
    /** Internal data only for logs/Sentry */
    internal?: InternalErrorData;
    /** Override HTTP status code */
    httpStatus?: number;
    /** Skip Sentry reporting */
    skipSentry?: boolean;
};

/**
 * Creates a lightweight error data object with clear public/internal separation
 *
 * @param type - Error type (determines HTTP status and categorization)
 * @param message - Internal message for logs (not sent to users)
 * @param options - Public and internal data
 *
 * @example
 * ```typescript
 * // Simple error
 * const error = createErrorData(ErrorType.NOT_FOUND, "User not found", {
 *   public: { title: "Not Found", detail: "The requested user does not exist" },
 *   internal: { context: { userId: "123" } }
 * });
 *
 * // Wrap internal error
 * try {
 *   await db.query();
 * } catch (err) {
 *   const error = createErrorData(ErrorType.DATABASE, "Query failed", {
 *     public: { detail: "Unable to fetch data" },
 *     internal: {
 *       cause: err as Error,
 *       context: { query: "SELECT...", params }
 *     }
 *   });
 * }
 * ```
 */
export function createErrorData(
    type: ErrorType,
    message: string,
    options?: CreateErrorDataOptions
): ErrorData {
    return {
        type,
        message,
        public: options?.public,
        internal: options?.internal,
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    };
}

/**
 * Gets the HTTP status code for an error data object
 */
export function getHttpStatus(error: ErrorData): number {
    if (error.httpStatus !== undefined) {
        return error.httpStatus;
    }

    const defaultStatus = DEFAULT_HTTP_STATUS_MAP[error.type] || 500;
    return errorConfig.getHttpStatus(error.type, defaultStatus);
}

/**
 * Converts error data to RFC 9457 compliant ErrorResponse
 * Only includes public data, internal data is excluded
 *
 * RFC 9457: https://www.rfc-editor.org/rfc/rfc9457.html
 *
 * @example
 * ```typescript
 * // Default URN format from ErrorType
 * const error = notFound("user", userId);
 * toErrorResponse(error);
 * // Returns: { type: "urn:problem:not-found", title: "...", status: 404, ... }
 *
 * // Custom type string
 * const error = notFound("user", userId, {
 *   public: { type: "user-not-found" }
 * });
 * toErrorResponse(error);
 * // Returns: { type: "urn:problem:user-not-found", ... }
 *
 * // Full URL
 * const error = notFound("user", userId, {
 *   public: { type: "https://api.example.com/errors/user-not-found" }
 * });
 * toErrorResponse(error);
 * // Returns: { type: "https://api.example.com/errors/user-not-found", ... }
 * ```
 */
export function toErrorResponse(error: ErrorData, baseUrl?: string): ErrorResponse {
    const statusCode = getHttpStatus(error);

    // Build type identifier (RFC 9457)
    let typeUri: string;
    if (error.public?.type) {
        // If url is provided
        if (baseUrl) {
            // Full URL - use as is
            typeUri =`${baseUrl}/${error.public.type}`;
        } else {
            // Custom string - add URN prefix
            typeUri = `urn:problem:${error.public.type}`;
        }
    } else {
        typeUri = `urn:problem:${error.type}`;
    }

    const response: ErrorResponse = {
        type: typeUri,
        title: error.public?.title ?? "Error",
        status: statusCode,
        detail: error.public?.detail,
        instance: error.public?.instance,
    };

    // Add validation errors if present
    if (error.public?.validationErrors && error.public.validationErrors.length > 0) {
        response.errors = error.public.validationErrors;
    }

    // Add public metadata if present
    if (error.public?.meta && Object.keys(error.public.meta).length > 0) {
        response.meta = error.public.meta;
    }

    return response;
}

/**
 * Converts error data to HTTP response (status + body)
 * Only includes public data, internal context is never sent to users
 */
export function toHttpResponse(
    error: ErrorData,
    options?: {
        includeErrorDetails?: boolean;
    }
): { statusCode: number; body: ErrorResponse } {
    const statusCode = getHttpStatus(error);
    const body = toErrorResponse(error);

    // In development, include internal message for 5xx errors if detail not provided
    if (options?.includeErrorDetails && statusCode >= 500 && !body.detail) {
        body.detail = error.message;
    }

    return { statusCode, body };
}

/**
 * Checks if error should be sent to Sentry
 */
export function shouldSendToSentry(error: ErrorData): boolean {
    if (error.skipSentry) {
        return false;
    }
    const statusCode = getHttpStatus(error);
    return errorConfig.shouldSendToSentry(statusCode);
}

/**
 * Converts error data to plain object for logging
 * Includes both public and internal data
 */
export function toLogObject(error: ErrorData): Record<string, unknown> {
    const logObj: Record<string, unknown> = {
        type: error.type,
        message: error.message,
        httpStatus: getHttpStatus(error),
    };

    // Add public data
    if (error.public) {
        logObj["public"] = error.public;
    }

    // Add internal data (cause, context, tags)
    if (error.internal) {
        if (error.internal.cause) {
            logObj["error"] = {
                name: error.internal.cause.name,
                message: error.internal.cause.message,
                stack: error.internal.cause.stack,
            };
        }
        if (error.internal.context) {
            logObj["context"] = error.internal.context;
        }
        if (error.internal.tags) {
            logObj["tags"] = error.internal.tags;
        }
    }

    return logObj;
}

/**
 * Extracts the original Error from ErrorData for Sentry reporting
 */
export function getOriginalError(error: ErrorData): Error | undefined {
    return error.internal?.cause;
}

/**
 * Extracts Sentry tags from ErrorData
 */
export function getSentryTags(error: ErrorData): Record<string, string> | undefined {
    return error.internal?.tags;
}
