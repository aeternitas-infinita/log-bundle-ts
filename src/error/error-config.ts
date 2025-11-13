import { type ErrorType } from "./error-types.js";

/**
 * Global configuration for error handling
 */
class ErrorConfig {
    private static instance: ErrorConfig;

    private sentryEnabledFlag = false;
    private sentryStatusCodes: number[] = [500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511];
    private customStatusMap = new Map<ErrorType, number>();
    private customErrorTypes = new Map<string, number>();

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    static getInstance(): ErrorConfig {
        ErrorConfig.instance ??= new ErrorConfig();
        return ErrorConfig.instance;
    }

    /**
     * Enable or disable Sentry globally for error handling
     * Default: false
     */
    setSentryEnabled(enabled: boolean): void {
        this.sentryEnabledFlag = enabled;
    }

    /**
     * Check if Sentry is enabled
     */
    isSentryEnabled(): boolean {
        return this.sentryEnabledFlag;
    }

    /**
     * Set which HTTP status codes should be sent to Sentry
     * Default: 5xx errors (500-511)
     *
     * @example
     * ```typescript
     * // Only send 500 and 503
     * errorConfig.setSentryStatusCodes([500, 503]);
     *
     * // Send all 5xx
     * errorConfig.setSentryStatusCodes([500, 501, 502, 503, 504]);
     *
     * // Send specific 4xx too
     * errorConfig.setSentryStatusCodes([401, 403, 500, 502]);
     * ```
     */
    setSentryStatusCodes(statusCodes: number[]): void {
        this.sentryStatusCodes = [...statusCodes];
    }

    /**
     * Get list of status codes that should be sent to Sentry
     */
    getSentryStatusCodes(): number[] {
        return [...this.sentryStatusCodes];
    }

    /**
     * Check if a status code should be sent to Sentry
     */
    shouldSendToSentry(statusCode: number): boolean {
        return this.sentryEnabledFlag && this.sentryStatusCodes.includes(statusCode);
    }

    /**
     * Register a custom error type with its HTTP status code
     *
     * @example
     * ```typescript
     * errorConfig.registerErrorType("rate_limited" as ErrorType, 429);
     * ```
     */
    registerErrorType(errorType: string, httpStatus: number): void {
        this.customErrorTypes.set(errorType, httpStatus);
    }

    /**
     * Set custom HTTP status mapping for existing error types
     *
     * @example
     * ```typescript
     * errorConfig.setCustomStatusMap({
     *     [ErrorType.NOT_FOUND]: 410,
     *     [ErrorType.BUSY]: 429
     * });
     * ```
     */
    setCustomStatusMap(mapping: Record<string, number>): void {
        for (const [errorType, status] of Object.entries(mapping)) {
            this.customStatusMap.set(errorType as ErrorType, status);
        }
    }

    /**
     * Get HTTP status for an error type (checks custom mappings first)
     */
    getHttpStatus(errorType: ErrorType, defaultStatus: number): number {
        // Check custom type mapping first
        const customStatus = this.customStatusMap.get(errorType);
        if (customStatus !== undefined) {
            return customStatus;
        }

        // Check if it's a custom registered type
        const customTypeStatus = this.customErrorTypes.get(errorType);
        if (customTypeStatus !== undefined) {
            return customTypeStatus;
        }

        return defaultStatus;
    }

    /**
     * Clear all custom mappings (reset to defaults)
     */
    reset(): void {
        this.customStatusMap.clear();
        this.customErrorTypes.clear();
        this.sentryStatusCodes = [500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511];
        this.sentryEnabledFlag = false;
    }
}

export const errorConfig = ErrorConfig.getInstance();
