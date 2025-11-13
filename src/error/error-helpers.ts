import { ErrorType } from "./error-types.js";

/**
 * HttpError - A lightweight throwable error for route handlers
 * Carries metadata but delegates to ErrorData for response formatting
 */
export class HttpError extends Error {
    public override readonly cause?: Error;

    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly errorType: ErrorType,
        public readonly context?: Record<string, unknown>,
        public readonly skipSentry?: boolean,
        cause?: Error
    ) {
        super(message);
        this.name = "HttpError";
        this.cause = cause;

        // Preserve original stack if wrapping
        if (cause?.stack) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }

    /**
     * Wraps another error, preserving its stack trace
     */
    wrap(error: Error): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).cause = error;
        if (error.stack) {
            this.stack = `${this.stack}\nCaused by: ${error.stack}`;
        }
        return this;
    }
}

/**
 * Type guard to check if error is an HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
    return error instanceof HttpError;
}

/**
 * INTERNAL ONLY - Throw function for internal server errors
 * This is the only throw helper provided to prevent users from throwing
 * custom error types. Users should use new HttpError() directly for custom types.
 *
 * @example
 * ```typescript
 * // For internal errors - use helper
 * throwInternal("Database connection failed", originalError);
 *
 * // For custom types - use HttpError directly
 * throw new HttpError("Custom error", 404, ErrorType.NOT_FOUND, { id: 123 });
 * ```
 */
export function throwInternal(message: string, cause?: Error): never {
    throw new HttpError(message, 500, ErrorType.INTERNAL, undefined, undefined, cause);
}
