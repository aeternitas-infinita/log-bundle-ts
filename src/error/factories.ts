/* eslint-disable @typescript-eslint/no-explicit-any */
import { createErrorData, type ErrorData } from "./error-data.js";
import { ErrorType } from "./error-types.js";

/**
 * Creates a NOT_FOUND error (404)
 * @param resource - The type of resource that was not found
 * @param id - The identifier of the resource
 * @param context - Additional context (e.g., requestId, url, query params)
 */
export function notFound(resource: string, id?: unknown, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.NOT_FOUND, `${resource} not found`, {
        title: "Resource Not Found",
        detail: `The requested ${resource} could not be found`,
        context: { resource, resource_id: id, ...context },
    });
}

/**
 * Creates a VALIDATION error (400)
 * @param message - The validation error message
 * @param field - Optional field that failed validation
 * @param context - Additional context (e.g., requestId, url, query params)
 */
export function validation(message: string, field?: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.VALIDATION, `validation failed: ${message}`, {
        title: "Validation Failed",
        detail: message,
        context: { ...(field ? { field } : {}), ...context },
        validationErrors: field ? [{ field, message }] : undefined,
    });
}

/**
 * Creates a DATABASE error (500)
 * @param message - The error message
 * @param context - Additional context (e.g., requestId, url, query)
 */
export function database(message: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.DATABASE, message, {
        title: "Database Error",
        detail: "An error occurred while accessing the database",
        context,
    });
}

/**
 * Creates an INTERNAL error (500)
 * @param message - The error message
 * @param context - Additional context (e.g., requestId, url, stackTrace)
 */
export function internal(message: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.INTERNAL, message, {
        title: "Internal Server Error",
        detail: "An unexpected error occurred",
        context,
    });
}

/**
 * Creates a FORBIDDEN error (403)
 * @param resource - The type of resource
 * @param reason - The reason access was forbidden
 * @param context - Additional context (e.g., requestId, userId, url)
 */
export function forbidden(resource: string, reason?: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.FORBIDDEN, `access forbidden: ${reason ?? "insufficient permissions"}`, {
        title: "Access Forbidden",
        detail: `Access to ${resource} is forbidden${reason ? `: ${reason}` : ""}`,
        context: { resource, reason, ...context },
    });
}

/**
 * Creates an UNAUTHORIZED error (401)
 * @param reason - The reason for unauthorized access
 * @param context - Additional context (e.g., requestId, url)
 */
export function unauthorized(reason?: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.UNAUTHORIZED, `unauthorized: ${reason ?? "authentication required"}`, {
        title: "Unauthorized",
        detail: `Authentication is required${reason ? `: ${reason}` : ""}`,
        context: { ...(reason ? { reason } : {}), ...context },
    });
}

/**
 * Creates a BAD_INPUT error (400)
 * @param message - The error message
 * @param context - Additional context (e.g., requestId, input data)
 */
export function badInput(message: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.BAD_INPUT, message, {
        title: "Bad Request",
        detail: "The request contains invalid input",
        context,
    });
}

/**
 * Creates a CONFLICT error (409)
 * @param resource - The type of resource
 * @param reason - The reason for the conflict
 * @param context - Additional context (e.g., requestId, existing resource id)
 */
export function conflict(resource: string, reason?: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.CONFLICT, `${resource} conflict: ${reason ?? "resource already exists"}`, {
        title: "Resource Conflict",
        detail: `A conflict occurred with ${resource}${reason ? `: ${reason}` : ""}`,
        context: { resource, reason, ...context },
    });
}

/**
 * Creates an EXTERNAL error (502)
 * @param service - The name of the external service
 * @param message - The error message
 * @param context - Additional context (e.g., requestId, url, statusCode)
 */
export function external(service: string, message: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.EXTERNAL, `external service error: ${service} - ${message}`, {
        title: "External Service Error",
        detail: `An error occurred while communicating with ${service}`,
        context: { service, ...context },
    });
}

/**
 * Creates a TIMEOUT error (504)
 * @param operation - The operation that timed out
 * @param duration - Optional duration that was exceeded
 * @param context - Additional context (e.g., requestId, url)
 */
export function timeout(operation: string, duration?: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.TIMEOUT, `timeout: ${operation}${duration ? ` exceeded ${duration}` : ""}`, {
        title: "Request Timeout",
        detail: `The operation '${operation}' timed out${duration ? ` after ${duration}` : ""}`,
        context: { operation, duration, ...context },
    });
}

/**
 * Creates a BUSY error (503)
 * @param message - The error message
 * @param context - Additional context (e.g., requestId, retryAfter)
 */
export function busy(message: string, context?: Record<string, any>): ErrorData {
    return createErrorData(ErrorType.BUSY, message, {
        title: "Service Unavailable",
        detail: "The service is temporarily unavailable",
        context,
    });
}
