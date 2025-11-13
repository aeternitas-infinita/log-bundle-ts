import * as Sentry from "@sentry/node";
import type * as pino from "pino";
import { isSentryInitialized } from "./sentry/plugin.js";

export type ProcessErrorHandlerOptions = {
    /**
     * Whether to exit the process after uncaught exception
     * Default: false (app will try to recover)
     */
    exitOnUncaughtException?: boolean;

    /**
     * Timeout in milliseconds to flush Sentry before exit
     * Default: 2000
     */
    sentryFlushTimeout?: number;

    /**
     * Whether to handle SIGTERM signal
     * Default: true
     */
    handleSigterm?: boolean;

    /**
     * Whether to handle SIGINT signal
     * Default: true
     */
    handleSigint?: boolean;
}

/**
 * Sets up process error handlers to prevent app crashes and log errors properly
 * @param logger - Pino logger instance to use for logging
 * @param options - Configuration options
 */
export function setupProcessErrorHandlers(logger: pino.Logger, options: ProcessErrorHandlerOptions = {}): void {
    const {
        exitOnUncaughtException = false,
        sentryFlushTimeout = 2000,
        handleSigterm = true,
        handleSigint = true,
    } = options;

    // Handle uncaught exceptions
    process.on("uncaughtException", (error: Error, origin: string) => {
        logger.fatal(
            {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
                origin,
            },
            "Uncaught Exception detected"
        );

        // Send to Sentry with high priority (if enabled)
        if (isSentryInitialized()) {
            Sentry.captureException(error, {
                level: "fatal",
                tags: {
                    error_handler: "uncaughtException",
                    origin,
                },
            });

            // Flush Sentry before potential exit
            Sentry.flush(sentryFlushTimeout)
                .then(() => {
                    logger.info("Sentry flushed after uncaught exception");
                    if (exitOnUncaughtException) {
                        process.exit(1);
                    }
                })
                .catch((err) => {
                    logger.error({ err }, "Failed to flush Sentry");
                    if (exitOnUncaughtException) {
                        process.exit(1);
                    }
                });
        } else if (exitOnUncaughtException) {
            process.exit(1);
        }

        if (!exitOnUncaughtException) {
            logger.warn("Application continuing after uncaught exception (monitor for stability)");
        }
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));

        logger.error(
            {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
                reason: String(reason),
                promise: String(promise),
            },
            "Unhandled Promise Rejection detected"
        );

        // Send to Sentry (if enabled)
        if (isSentryInitialized()) {
            Sentry.captureException(error, {
                level: "error",
                tags: {
                    error_handler: "unhandledRejection",
                },
                contexts: {
                    promise: {
                        reason: String(reason),
                    },
                },
            });
        }

        // Don't crash the app for unhandled rejections
        logger.warn("Application continuing after unhandled rejection");
    });

    // Handle process warnings
    process.on("warning", (warning: Error) => {
        logger.warn(
            {
                warning: {
                    name: warning.name,
                    message: warning.message,
                    stack: warning.stack,
                },
            },
            "Process warning detected"
        );
    });

    // Handle SIGTERM for graceful shutdown
    if (handleSigterm) {
        process.on("SIGTERM", () => {
            logger.info("SIGTERM signal received: closing HTTP server");

            if (isSentryInitialized()) {
                Sentry.flush(sentryFlushTimeout)
                    .then(() => {
                        logger.info("Sentry flushed successfully");
                        process.exit(0);
                    })
                    .catch((err) => {
                        logger.error({ err }, "Failed to flush Sentry on SIGTERM");
                        process.exit(1);
                    });
            } else {
                process.exit(0);
            }
        });
    }

    // Handle SIGINT (Ctrl+C) for graceful shutdown
    if (handleSigint) {
        process.on("SIGINT", () => {
            logger.info("SIGINT signal received: closing HTTP server");

            if (isSentryInitialized()) {
                Sentry.flush(sentryFlushTimeout)
                    .then(() => {
                        logger.info("Sentry flushed successfully");
                        process.exit(0);
                    })
                    .catch((err) => {
                        logger.error({ err }, "Failed to flush Sentry on SIGINT");
                        process.exit(1);
                    });
            } else {
                process.exit(0);
            }
        });
    }

    logger.info("Process error handlers configured");
}
