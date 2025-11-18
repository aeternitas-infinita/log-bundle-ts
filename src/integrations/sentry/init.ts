/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logConfig } from "../../core/config.js";

export type SentryInitConfig = {
    /**
     * Sentry DSN (Data Source Name)
     */
    dsn: string;

    /**
     * Application environment (e.g., "production", "development", "staging")
     */
    environment: string;

    /**
     * Enable profiling integration
     * @default false
     */
    enableProfiling?: boolean;

    /**
     * Enable PostgreSQL integration
     * @default false
     */
    enablePostgres?: boolean;

    /**
     * Sample rate for traces (0.0 to 1.0)
     * @default 0.1
     */
    tracesSampleRate?: number;

    /**
     * Sample rate for profiles (0.0 to 1.0)
     * @default same as tracesSampleRate
     */
    profilesSampleRate?: number;

    /**
     * Headers to redact from Sentry events (for security)
     * @default ["authorization", "cookie", "x-api-key"]
     */
    redactHeaders?: string[];

    /**
     * Custom beforeSend hook for additional filtering
     */
    beforeSend?: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;

    /**
     * Additional Sentry integrations
     */
    additionalIntegrations?: any[];
};

/**
 * Initialize Sentry with best practices for Fastify applications
 * This helper reduces Sentry setup boilerplate and applies security best practices
 *
 * IMPORTANT: Call this function BEFORE importing any other modules to ensure
 * Sentry can properly instrument your application.
 *
 * @example
 * ```typescript
 * // At the very top of your entry file (e.g., index.ts or server.ts)
 * import { initSentryForFastify } from "log-bundle";
 *
 * initSentryForFastify({
 *   dsn: process.env.SENTRY_DSN!,
 *   environment: process.env.NODE_ENV!,
 *   enableProfiling: true,
 *   enablePostgres: true
 * });
 *
 * // Now import other modules
 * import fastify from "fastify";
 * // ...
 * ```
 */
export function initSentryForFastify(config: SentryInitConfig): void {
    const {
        dsn,
        environment,
        enableProfiling = false,
        enablePostgres = false,
        tracesSampleRate = 0.1,
        profilesSampleRate = tracesSampleRate,
        redactHeaders = ["authorization", "cookie", "x-api-key"],
        beforeSend,
        additionalIntegrations = [],
    } = config;

    // Build integrations list
    const integrations: any[] = [
        // HTTP instrumentation for incoming requests
        Sentry.httpIntegration(),

        // Request data integration with sensible defaults
        Sentry.requestDataIntegration({
            include: {
                cookies: false, // Don't include cookies (security)
                data: true, // Include request body
                headers: true, // Include headers (will be redacted)
                ip: true, // Include IP address
            },
        }),
    ];

    // Add profiling integration if enabled
    if (enableProfiling) {
        integrations.push(nodeProfilingIntegration());
    }

    // Add PostgreSQL integration if enabled
    if (enablePostgres) {
        integrations.push(Sentry.postgresIntegration());
    }

    // Error handlers for uncaught exceptions and unhandled rejections
    integrations.push(
        Sentry.onUncaughtExceptionIntegration({
            exitEvenIfOtherHandlersAreRegistered: false,
            onFatalError: (err) => {
                console.error("Sentry: Fatal error", err);
            },
        }),
        Sentry.onUnhandledRejectionIntegration({
            mode: "warn", // Don't exit on unhandled rejection, just log
        })
    );

    // Add any additional integrations provided by user
    integrations.push(...additionalIntegrations);

    // Initialize Sentry
    Sentry.init({
        dsn,
        environment,
        tracesSampleRate,
        profilesSampleRate,
        sendDefaultPii: environment === "development", // Only send PII in development
        integrations,
        beforeSend: (event, hint) => {
            // Security: Redact sensitive headers
            if (event.request?.headers) {
                for (const header of redactHeaders) {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete event.request.headers[header];
                }
            }

            // Don't send Zod validation errors (they're expected user errors)
            const exception = hint?.originalException as any;
            if (exception?.name === "ZodError") {
                return null;
            }

            // Don't send 4xx client errors (except 401/403 which indicate auth issues)
            const status = event.contexts?.response?.status_code;
            if (status && status >= 400 && status < 500 && ![401, 403].includes(status)) {
                return null;
            }

            // Apply custom beforeSend hook if provided
            if (beforeSend) {
                return beforeSend(event, hint);
            }

            return event;
        },
    });

    // Enable Sentry in log-bundle
    logConfig.enableSentry = true;
}
