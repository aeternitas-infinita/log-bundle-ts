/**
 * Global configuration store for log-bundle
 */
export type LogBundleConfig = {
    /**
     * Enable/disable Sentry integration globally
     * @default false
     */
    enableSentry: boolean;
}

/**
 * Global configuration for log-bundle
 * You can modify this at runtime to control library behavior
 */
export const logConfig: LogBundleConfig = {
    enableSentry: false,
};
