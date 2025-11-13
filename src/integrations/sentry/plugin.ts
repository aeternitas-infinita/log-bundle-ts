/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from "@sentry/node";
import type * as pino from "pino";
import { getSource } from "../../core/helpers.js";

/**
 * Checks if Sentry has been initialized
 * Note: You must initialize Sentry manually before using this library
 */
export function isSentryInitialized(): boolean {
    try {
        return Sentry.getClient() !== undefined;
    } catch {
        return false;
    }
}

export type SentrySendOptions = {
    captureContext?: boolean;
    tags?: Record<string, string>;
}

const PINO_TO_SENTRY_LEVEL: Record<string, Sentry.SeverityLevel> = {
    trace: "debug",
    debug: "debug",
    info: "info",
    warn: "warning",
    error: "error",
    fatal: "fatal",
};

// Keys to exclude from context capture - defined once to avoid repeated array allocation
const EXCLUDED_KEYS = new Set(["msg", "message", "level", "time", "err", "error", "stack", "source"]);

/**
 * Manually sends a log entry to Sentry
 * @param level - The log level (trace, debug, info, warn, error, fatal)
 * @param logObj - The log object containing message and additional context
 * @param message - Optional message string
 * @param options - Configuration options for Sentry sending
 */
export function sendToSentry(level: pino.Level, logObj: any = {}, message = "", options: SentrySendOptions = {}): void {
    if (!isSentryInitialized()) {
        return;
    }

    try {
        const { captureContext = true, tags = {} } = options;

        // Extract message if not provided
        const finalMessage = message ?? logObj.msg ?? logObj.message ?? "Log message";

        const sentryLevel = PINO_TO_SENTRY_LEVEL[level] ?? "info";
        const isError = level === "error" || level === "fatal" || logObj.err || logObj.error;

        Sentry.withScope((scope) => {
            scope.setLevel(sentryLevel);

            // Set custom tags
            for (const [key, value] of Object.entries(tags)) {
                scope.setTag(key, value);
            }

            scope.setTag("log.level", level);
            scope.setTag("logger", "pino");

            // Set source tag (use cached source if not in logObj)
            const sourceFromLog = logObj.source ?? getSource();
            scope.setTag("source", sourceFromLog);

            // Capture additional context
            if (captureContext) {
                const context: Record<string, any> = {};

                for (const [key, value] of Object.entries(logObj)) {
                    if (!EXCLUDED_KEYS.has(key)) {
                        context[key] = value;
                    }
                }

                if (Object.keys(context).length > 0) {
                    scope.setContext("log_data", context);
                }
            }

            // Send to Sentry
            if (isError) {
                const error = logObj.err ?? logObj.error;

                if (error instanceof Error) {
                    Sentry.captureException(error);
                } else if (error && typeof error === "object") {
                    const err = new Error(finalMessage ?? error.message ?? "Unknown error");
                    if (error.stack) {
                        err.stack = error.stack;
                    }
                    Sentry.captureException(err);
                } else {
                    Sentry.captureMessage(finalMessage, sentryLevel);
                }
            } else {
                Sentry.captureMessage(finalMessage, sentryLevel);
            }
        });
    } catch (sentryError) {
        console.warn("Sentry send error:", sentryError);
    }
}
