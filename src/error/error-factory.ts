/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ErrorData } from "./error-data.js";
import * as factories from "./factories.js";

/**
 * Factory class for creating errors with bound context
 * Useful for automatically injecting request metadata (requestId, url, etc.) into all errors
 *
 * @example
 * ```typescript
 * // In a Fastify route:
 * const errors = ErrorFactory.forRequest(request);
 * const error = errors.notFound("user", userId);
 * // Error automatically includes requestId, url, method, ip
 * ```
 */
export class ErrorFactory {
    /**
     * Creates an error factory with bound context
     * @param context - Context to be added to all errors (e.g., { requestId, url, method })
     */
    constructor(private readonly context: Record<string, any>) {}

    /**
     * Creates a NOT_FOUND error (404) with bound context
     */
    notFound(resource: string, id?: unknown, additionalContext?: Record<string, any>): ErrorData {
        return factories.notFound(resource, id, { ...this.context, ...additionalContext });
    }

    /**
     * Creates a VALIDATION error (400) with bound context
     */
    validation(message: string, field?: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.validation(message, field, { ...this.context, ...additionalContext });
    }

    /**
     * Creates a DATABASE error (500) with bound context
     */
    database(message: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.database(message, { ...this.context, ...additionalContext });
    }

    /**
     * Creates an INTERNAL error (500) with bound context
     */
    internal(message: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.internal(message, { ...this.context, ...additionalContext });
    }

    /**
     * Creates a FORBIDDEN error (403) with bound context
     */
    forbidden(resource: string, reason?: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.forbidden(resource, reason, { ...this.context, ...additionalContext });
    }

    /**
     * Creates an UNAUTHORIZED error (401) with bound context
     */
    unauthorized(reason?: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.unauthorized(reason, { ...this.context, ...additionalContext });
    }

    /**
     * Creates a BAD_INPUT error (400) with bound context
     */
    badInput(message: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.badInput(message, { ...this.context, ...additionalContext });
    }

    /**
     * Creates a CONFLICT error (409) with bound context
     */
    conflict(resource: string, reason?: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.conflict(resource, reason, { ...this.context, ...additionalContext });
    }

    /**
     * Creates an EXTERNAL error (502) with bound context
     */
    external(service: string, message: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.external(service, message, { ...this.context, ...additionalContext });
    }

    /**
     * Creates a TIMEOUT error (504) with bound context
     */
    timeout(operation: string, duration?: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.timeout(operation, duration, { ...this.context, ...additionalContext });
    }

    /**
     * Creates a BUSY error (503) with bound context
     */
    busy(message: string, additionalContext?: Record<string, any>): ErrorData {
        return factories.busy(message, { ...this.context, ...additionalContext });
    }

    /**
     * Creates an ErrorFactory with context from a Fastify request
     * Automatically extracts requestId, url, method, and ip
     *
     * @param request - Fastify request object
     * @returns ErrorFactory with request context bound
     *
     * @example
     * ```typescript
     * fastify.get('/users/:id', async (request, reply) => {
     *   const errors = ErrorFactory.forRequest(request);
     *
     *   const user = await getUserById(request.params.id);
     *   if (!user) {
     *     return reply.status(404).send(errors.notFound('user', request.params.id));
     *   }
     *
     *   return user;
     * });
     * ```
     */
    static forRequest(request: {
        id: string;
        url: string;
        method: string;
        ip: string;
        [key: string]: any;
    }): ErrorFactory {
        return new ErrorFactory({
            requestId: request.id,
            url: request.url,
            method: request.method,
            ip: request.ip,
        });
    }
}
