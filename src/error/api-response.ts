import type { ErrorResponse, SuccessResponse, ValidationError } from "./error-types.js";

/**
 * ApiResponse - Factory for creating consistent API responses
 *
 * Success responses follow the format:
 * ```json
 * {
 *   "data": <any>,
 *   "message": "optional"
 * }
 * ```
 *
 * Error responses follow RFC 9457 (Problem Details):
 * ```json
 * {
 *   "type": "https://example.com/problems/not-found",
 *   "title": "Resource Not Found",
 *   "status": 404,
 *   "detail": "The requested user could not be found",
 *   "instance": "/users/123",
 *   "errors": [{"field": "id", "message": "User not found"}],
 *   "meta": {"userId": "123"}
 * }
 * ```
 */
export const ApiResponse = {
    /**
     * Create a success response with data and optional message
     * @param data - Response data payload
     * @param message - Optional message for the client
     * @returns Standardized success response
     *
     * @example
     * ```typescript
     * return reply.status(200).send(ApiResponse.success(user));
     * return reply.status(200).send(ApiResponse.success(users, "Users retrieved successfully"));
     * ```
     */
    success<T>(data?: T, message?: string): SuccessResponse<T> {
        const response: SuccessResponse<T> = {};

        if (data !== undefined) {
            response.data = data;
        }

        if (message !== undefined) {
            response.message = message;
        }

        return response;
    },

    /**
     * Manually construct an RFC 9457 compliant error response
     * IMPORTANT: This should rarely be used directly. Prefer using log-bundle error factories
     * (notFound, validation, etc.) with toHttpResponse() instead.
     *
     * @param type - Error type identifier (e.g., "validation", "not-found")
     * @param title - Human-readable error title
     * @param status - HTTP status code
     * @param options - Additional error details
     * @returns RFC 9457 compliant error response
     *
     * @example
     * ```typescript
     * // Prefer this approach with log-bundle:
     * const { statusCode, body } = toHttpResponse(notFound("user", userId));
     * return reply.status(statusCode).send(body);
     *
     * // Only use manual construction when absolutely necessary:
     * const errorBody = ApiResponse.error("custom-error", "Custom Error", 400, {
     *   detail: "Something specific happened",
     *   errors: [{ field: "customField", message: "Invalid value" }]
     * });
     * return reply.status(400).send(errorBody);
     * ```
     */
    error(
        type: string,
        title: string,
        status: number,
        options?: {
            detail?: string;
            instance?: string;
            errors?: ValidationError[];
            meta?: Record<string, unknown>;
        }
    ): ErrorResponse {
        return {
            type: `urn:problem:${type}`,
            title,
            status,
            detail: options?.detail,
            instance: options?.instance,
            errors: options?.errors,
            meta: options?.meta,
        };
    },
} as const;
