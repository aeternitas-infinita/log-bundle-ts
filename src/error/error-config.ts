import { type ErrorType } from "./error-types.js";

/**
 * Represents a status code rule for Sentry filtering
 */
export type StatusCodeRule =
    | number                    // Specific code: 404
    | [number, number]          // Range: [500, 599] for all 5xx
    | { range: [number, number], exclude?: number[] };  // Range with exclusions

/**
 * Global configuration for error handling
 */
class ErrorConfig {
    private static instance: ErrorConfig;

    private sentryStatusRules: StatusCodeRule[] = [[500, 599]];
    private customStatusMap = new Map<ErrorType, number>();
    private customErrorTypes = new Map<string, number>();

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() {}

    static getInstance(): ErrorConfig {
        ErrorConfig.instance ??= new ErrorConfig();
        return ErrorConfig.instance;
    }

    /**
     * Set which HTTP status codes should be sent to Sentry
     * Default: all 5xx errors ([500, 599])
     *
     * @example
     * ```typescript
     * // Only send specific codes
     * errorConfig.setSentryStatusRules([500, 503]);
     *
     * // Send all 5xx
     * errorConfig.setSentryStatusRules([[500, 599]]);
     *
     * // Send all 4xx and 5xx
     * errorConfig.setSentryStatusRules([[400, 499], [500, 599]]);
     *
     * // Send all 5xx except 502 and 503
     * errorConfig.setSentryStatusRules([{ range: [500, 599], exclude: [502, 503] }]);
     *
     * // Mix specific codes and ranges
     * errorConfig.setSentryStatusRules([429, [500, 599]]);
     * ```
     */
    setSentryStatusRules(rules: StatusCodeRule[]): void {
        this.sentryStatusRules = [...rules];
    }

    /**
     * Get current Sentry status rules
     */
    getSentryStatusRules(): StatusCodeRule[] {
        return [...this.sentryStatusRules];
    }

    /**
     * Check if a status code should be sent to Sentry
     * Performance: O(r) where r is number of rules (typically small)
     */
    shouldSendToSentry(statusCode: number): boolean {
        return this.sentryStatusRules.some(rule => {
            if (typeof rule === 'number') {
                return statusCode === rule;
            }

            if (Array.isArray(rule)) {
                const [min, max] = rule;
                return statusCode >= min && statusCode <= max;
            }

            // Object with range and exclusions
            const [min, max] = rule.range;
            const inRange = statusCode >= min && statusCode <= max;
            const isExcluded = rule.exclude?.includes(statusCode) ?? false;
            return inRange && !isExcluded;
        });
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
        this.sentryStatusRules = [[500, 599]];
    }
}

export const errorConfig = ErrorConfig.getInstance();
