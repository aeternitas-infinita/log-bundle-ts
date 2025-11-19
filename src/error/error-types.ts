/**
 * ErrorType represents the category of an error
 * Each type maps to a default HTTP status code
 */
export enum ErrorType {
    INTERNAL = "internal", // Internal server errors (500)
    NOT_FOUND = "not-found", // Resource not found (404)
    VALIDATION = "validation", // Validation failures (400)
    DATABASE = "database", // Database errors (500)
    BUSY = "busy", // Service busy/unavailable (503)
    FORBIDDEN = "forbidden", // Access forbidden (403)
    BAD_INPUT = "bad-input", // Bad request input (400)
    UNAUTHORIZED = "unauthorized", // Unauthorized access (401)
    CONFLICT = "conflict", // Resource conflict (409)
    EXTERNAL = "external", // External service error (502)
    TIMEOUT = "timeout", // Request timeout (504)
}

/**
 * ValidationError represents a single field validation error
 * Following RFC 7807 problem details standard
 */
export type ValidationError = {
    /** Field name that failed validation */
    field: string;
    /** Human-readable error message */
    message: string;
    /** The value that failed validation (optional) */
    value?: unknown;
}

/**
 * ErrorResponse represents the standard error response format
 * Following RFC 7807 Problem Details for HTTP APIs
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export type ErrorResponse = {
    /** A URI reference that identifies the problem type (RFC 7807 required) */
    type: string;
    /** Human-readable summary of the error (RFC 7807 required) */
    title: string;
    /** HTTP status code (RFC 7807 required) */
    status: number;
    /** Human-readable explanation specific to this occurrence (RFC 7807 optional) */
    detail?: string;
    /** URI reference to the specific occurrence (RFC 7807 optional) */
    instance?: string;
    /** Validation errors for fields (extension) */
    errors?: ValidationError[];
    /** Additional context/metadata (extension) */
    meta?: Record<string, unknown>;
}

/**
 * Response is a generic response wrapper for successful API responses
 */
export type SuccessResponse<T = unknown> = {
    /** The response payload */
    data?: T;
    /** Optional message for the client */
    message?: string;
}

/**
 * Default HTTP status codes for each error type
 */
export const DEFAULT_HTTP_STATUS_MAP: Record<ErrorType, number> = {
    [ErrorType.INTERNAL]: 500,
    [ErrorType.NOT_FOUND]: 404,
    [ErrorType.VALIDATION]: 400,
    [ErrorType.DATABASE]: 500,
    [ErrorType.BUSY]: 503,
    [ErrorType.FORBIDDEN]: 403,
    [ErrorType.BAD_INPUT]: 400,
    [ErrorType.UNAUTHORIZED]: 401,
    [ErrorType.CONFLICT]: 409,
    [ErrorType.EXTERNAL]: 502,
    [ErrorType.TIMEOUT]: 504,
};
