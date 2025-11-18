import { createErrorData, type CreateErrorDataOptions, type ErrorData } from "./error-data.js";
import { ErrorType } from "./error-types.js";

/**
 * Creates a NOT_FOUND error (404)
 * @param resource - The type of resource that was not found
 * @param id - The identifier of the resource
 * @param options - Additional options for public/internal data
 */
export function notFound(resource: string, id?: unknown, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.NOT_FOUND, `${resource} not found`, {
        public: {
            title: "Resource Not Found",
            detail: `The requested ${resource} could not be found`,
            ...options?.public,
        },
        internal: {
            context: { resource, ...(id !== undefined && { resource_id: id }), ...options?.internal?.context },
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates a VALIDATION error (400)
 * @param message - The validation error message
 * @param field - Optional field that failed validation
 * @param options - Additional options for public/internal data
 */
export function validation(message: string, field?: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.VALIDATION, `validation failed: ${message}`, {
        public: {
            title: "Validation Failed",
            detail: message,
            validationErrors: field ? [{ field, message }] : undefined,
            ...options?.public,
        },
        internal: {
            context: { ...(field ? { field } : {}), ...options?.internal?.context },
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates a DATABASE error (500)
 * @param message - The error message
 * @param options - Additional options for public/internal data
 */
export function database(message: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.DATABASE, message, {
        public: {
            title: "Database Error",
            detail: "An error occurred while accessing the database",
            ...options?.public,
        },
        internal: {
            context: options?.internal?.context,
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates an INTERNAL error (500)
 * @param message - The error message
 * @param options - Additional options for public/internal data
 */
export function internal(message: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.INTERNAL, message, {
        public: {
            title: "Internal Server Error",
            detail: "An unexpected error occurred",
            ...options?.public,
        },
        internal: {
            context: options?.internal?.context,
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates a FORBIDDEN error (403)
 * @param resource - The type of resource
 * @param reason - The reason access was forbidden
 * @param options - Additional options for public/internal data
 */
export function forbidden(resource: string, reason?: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.FORBIDDEN, `access forbidden: ${reason ?? "insufficient permissions"}`, {
        public: {
            title: "Access Forbidden",
            detail: `Access to ${resource} is forbidden${reason ? `: ${reason}` : ""}`,
            ...options?.public,
        },
        internal: {
            context: { resource, ...(reason && { reason }), ...options?.internal?.context },
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates an UNAUTHORIZED error (401)
 * @param reason - The reason for unauthorized access
 * @param options - Additional options for public/internal data
 */
export function unauthorized(reason?: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.UNAUTHORIZED, `unauthorized: ${reason ?? "authentication required"}`, {
        public: {
            title: "Unauthorized",
            detail: `Authentication is required${reason ? `: ${reason}` : ""}`,
            ...options?.public,
        },
        internal: {
            context: { ...(reason ? { reason } : {}), ...options?.internal?.context },
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates a BAD_INPUT error (400)
 * @param message - The error message
 * @param options - Additional options for public/internal data
 */
export function badInput(message: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.BAD_INPUT, message, {
        public: {
            title: "Bad Request",
            detail: "The request contains invalid input",
            ...options?.public,
        },
        internal: {
            context: options?.internal?.context,
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates a CONFLICT error (409)
 * @param resource - The type of resource
 * @param reason - The reason for the conflict
 * @param options - Additional options for public/internal data
 */
export function conflict(resource: string, reason?: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.CONFLICT, `${resource} conflict: ${reason ?? "resource already exists"}`, {
        public: {
            title: "Resource Conflict",
            detail: `A conflict occurred with ${resource}${reason ? `: ${reason}` : ""}`,
            ...options?.public,
        },
        internal: {
            context: { resource, ...(reason && { reason }), ...options?.internal?.context },
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates an EXTERNAL error (502)
 * @param service - The name of the external service
 * @param message - The error message
 * @param options - Additional options for public/internal data
 */
export function external(service: string, message: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.EXTERNAL, `external service error: ${service} - ${message}`, {
        public: {
            title: "External Service Error",
            detail: `An error occurred while communicating with ${service}`,
            ...options?.public,
        },
        internal: {
            context: { service, ...options?.internal?.context },
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates a TIMEOUT error (504)
 * @param operation - The operation that timed out
 * @param duration - Optional duration that was exceeded
 * @param options - Additional options for public/internal data
 */
export function timeout(operation: string, duration?: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.TIMEOUT, `timeout: ${operation}${duration ? ` exceeded ${duration}` : ""}`, {
        public: {
            title: "Request Timeout",
            detail: `The operation '${operation}' timed out${duration ? ` after ${duration}` : ""}`,
            ...options?.public,
        },
        internal: {
            context: { operation, ...(duration && { duration }), ...options?.internal?.context },
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}

/**
 * Creates a BUSY error (503)
 * @param message - The error message
 * @param options - Additional options for public/internal data
 */
export function busy(message: string, options?: CreateErrorDataOptions): ErrorData {
    return createErrorData(ErrorType.BUSY, message, {
        public: {
            title: "Service Unavailable",
            detail: "The service is temporarily unavailable",
            ...options?.public,
        },
        internal: {
            context: options?.internal?.context,
            cause: options?.internal?.cause,
            tags: options?.internal?.tags,
        },
        httpStatus: options?.httpStatus,
        skipSentry: options?.skipSentry,
    });
}
