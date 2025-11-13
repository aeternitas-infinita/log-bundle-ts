import type { ErrorResponse, ValidationError } from "./error-types.js";
import { DEFAULT_HTTP_STATUS_MAP, type ErrorType } from "./error-types.js";
import { errorConfig } from "./error-config.js";

/**
 * ErrorData represents a lightweight error object for logging and HTTP responses
 * This is a plain object, NOT an Error class - it cannot be thrown
 */
export type ErrorData = {
    /** Error type determining HTTP status */
    readonly type: ErrorType;
    /** Error message */
    readonly message: string;
    /** RFC 7807 title */
    readonly title?: string;
    /** RFC 7807 detail */
    readonly detail?: string;
    /** Context metadata */
    readonly context?: Record<string, unknown>;
    /** Validation errors */
    readonly validationErrors?: ValidationError[];
    /** HTTP status override */
    readonly httpStatus?: number;
    /** Should skip Sentry reporting */
    readonly skipSentry?: boolean;
}

/**
 * Creates a lightweight error data object
 * This is optimized for performance - uses plain objects instead of class instances
 */
export function createErrorData(
    type: ErrorType,
    message: string,
    options?: {
        title?: string;
        detail?: string;
        context?: Record<string, unknown>;
        validationErrors?: ValidationError[];
        httpStatus?: number;
        skipSentry?: boolean;
    }
): ErrorData {
    return {
        type,
        message,
        title: options?.title,
        detail: options?.detail,
        context: options?.context,
        validationErrors: options?.validationErrors,
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
 * Converts error data to RFC 7807 compliant ErrorResponse
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export function toErrorResponse(error: ErrorData, baseUrl?: string): ErrorResponse {
    const statusCode = getHttpStatus(error);

    // Generate type URI (RFC 7807 required)
    // Format: /errors/{error_type} or full URL if baseUrl provided
    const typeUri = baseUrl
        ? `${baseUrl}/errors/${error.type}`
        : `/errors/${error.type}`;

    const response: ErrorResponse = {
        type: typeUri,
        title: error.title ?? error.message,
        status: statusCode,
        detail: error.detail,
    };

    if (error.validationErrors && error.validationErrors.length > 0) {
        response.errors = error.validationErrors;
    }

    if (error.context && Object.keys(error.context).length > 0) {
        response.meta = error.context;
    }

    return response;
}

/**
 * Converts error data to HTTP response (status + body)
 */
export function toHttpResponse(
    error: ErrorData,
    options?: {
        includeErrorDetails?: boolean;
    }
): { statusCode: number; body: ErrorResponse } {
    const statusCode = getHttpStatus(error);
    const body = toErrorResponse(error);

    // Include error details in development for 5xx errors
    if (options?.includeErrorDetails && statusCode >= 500) {
        body.detail = body.detail ?? error.message;
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
 */
export function toLogObject(error: ErrorData): Record<string, unknown> {
    return {
        type: error.type,
        message: error.message,
        title: error.title,
        detail: error.detail,
        httpStatus: getHttpStatus(error),
        context: error.context,
        validationErrors: error.validationErrors,
        skipSentry: error.skipSentry,
    };
}
