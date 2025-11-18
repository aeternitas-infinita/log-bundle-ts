/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CreateErrorDataOptions, ErrorData } from "./error-data.js";
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
     * Merge context efficiently without unnecessary object spreading
     */
    private mergeContext(optionsContext?: Record<string, any>): Record<string, any> {
        if (!optionsContext) {
            return this.context;
        }
        return Object.assign({}, this.context, optionsContext);
    }

    /**
     * Creates a NOT_FOUND error (404) with bound context
     */
    notFound(resource: string, id?: unknown, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.notFound(resource, id, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates a VALIDATION error (400) with bound context
     */
    validation(message: string, field?: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.validation(message, field, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates a DATABASE error (500) with bound context
     */
    database(message: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.database(message, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates an INTERNAL error (500) with bound context
     */
    internal(message: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.internal(message, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates a FORBIDDEN error (403) with bound context
     */
    forbidden(resource: string, reason?: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.forbidden(resource, reason, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates an UNAUTHORIZED error (401) with bound context
     */
    unauthorized(reason?: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.unauthorized(reason, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates a BAD_INPUT error (400) with bound context
     */
    badInput(message: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.badInput(message, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates a CONFLICT error (409) with bound context
     */
    conflict(resource: string, reason?: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.conflict(resource, reason, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates an EXTERNAL error (502) with bound context
     */
    external(service: string, message: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.external(service, message, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates a TIMEOUT error (504) with bound context
     */
    timeout(operation: string, duration?: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.timeout(operation, duration, {
            ...options,
            internal: mergedInternal,
        });
    }

    /**
     * Creates a BUSY error (503) with bound context
     */
    busy(message: string, options?: CreateErrorDataOptions): ErrorData {
        const mergedInternal = options?.internal
            ? { ...options.internal, context: this.mergeContext(options.internal.context) }
            : { context: this.context };

        return factories.busy(message, {
            ...options,
            internal: mergedInternal,
        });
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
