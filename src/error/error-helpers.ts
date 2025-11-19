import { DEFAULT_HTTP_STATUS_MAP, ErrorType } from "./error-types.js";

/**
 * CustomError - A lightweight throwable error for route handlers and general error handling
 * Carries metadata but delegates to ErrorData for response formatting
 *
 * HTTP status code is optional - if not provided, it will be derived from errorType
 */
export class CustomError extends Error {
    public override readonly cause?: Error;
    public readonly statusCode?: number;
    public readonly context?: Record<string, unknown>;
    public readonly skipSentry?: boolean;

    // Private cache for computed values
    private _cachedStatusCode?: number;
    private _stackAccessed = false;

    constructor(
        message: string,
        public readonly errorType: ErrorType,
        options?: {
            statusCode?: number;
            context?: Record<string, unknown>;
            skipSentry?: boolean;
            cause?: Error;
        }
    ) {
        super(message);

        // Include errorType in name for better debugging
        this.name = `CustomError[${errorType}]`;

        this.statusCode = options?.statusCode;
        this.context = options?.context;
        this.skipSentry = options?.skipSentry;
        this.cause = options?.cause;

        // Cache status code on construction if explicitly provided
        if (options?.statusCode !== undefined) {
            this._cachedStatusCode = options.statusCode;
        }
    }

    /**
     * Lazy stack property getter - only concatenates cause stack when accessed
     * This improves performance when errors are thrown but stack isn't needed
     */
    public override get stack(): string | undefined {
        if (!this._stackAccessed && this.cause?.stack) {
            this._stackAccessed = true;
            const baseStack = super.stack;
            super.stack = `${baseStack}\nCaused by: ${this.cause.stack}`;
        }
        return super.stack;
    }

    public override set stack(value: string | undefined) {
        this._stackAccessed = true;
        super.stack = value;
    }

    /**
     * Gets the HTTP status code, deriving from errorType if not explicitly set
     * Uses cached value for performance
     */
    getStatusCode(): number {
        this._cachedStatusCode ??= this.statusCode ?? DEFAULT_HTTP_STATUS_MAP[this.errorType];
        return this._cachedStatusCode;
    }

    /**
     * Wraps another error, preserving its stack trace
     */
    wrap(error: Error): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).cause = error;
        this._stackAccessed = false; // Reset flag to trigger lazy concatenation
        return this;
    }

    /**
     * Custom JSON serialization for better logging and debugging
     * Only includes relevant fields without circular references
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            errorType: this.errorType,
            statusCode: this.getStatusCode(),
            context: this.context,
            skipSentry: this.skipSentry,
            // Include cause name and message but not full object to avoid circular refs
            cause: this.cause
                ? {
                      name: this.cause.name,
                      message: this.cause.message,
                  }
                : undefined,
        };
    }
}

/**
 * Type guard to check if error is a CustomError
 */
export function isCustomError(error: unknown): error is CustomError {
    return error instanceof CustomError;
}

/**
 * @example
 * ```typescript
 * // For internal errors - use helper
 * throwInternal("Database connection failed", originalError);
 *
 * // For custom types - use CustomError directly
 * throw new CustomError("Custom error", ErrorType.NOT_FOUND, {
 *   statusCode: 404,
 *   context: { id: 123 }
 * });
 * ```
 */
export function throwInternal(message: string, cause?: Error): never {
    throw new CustomError(message, ErrorType.INTERNAL, { statusCode: 500, cause });
}
