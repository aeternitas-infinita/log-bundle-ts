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
     * Whether to exit the process after unhandled rejection
     * Default: false (app will try to recover)
     */
    exitOnUnhandledRejection?: boolean;

    /**
     * Timeout in milliseconds to flush Sentry before exit
     * Default: 2000
     */
    sentryFlushTimeout?: number;

    /**
     * Whether to handle uncaught exceptions
     * Default: true
     */
    handleUncaughtException?: boolean;

    /**
     * Whether to handle unhandled promise rejections
     * Default: true
     */
    handleUnhandledRejection?: boolean;

    /**
     * Whether to handle process warnings
     * Default: true
     */
    handleWarnings?: boolean;

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

    /**
     * Lifecycle hook called when an uncaught exception occurs
     * @param error - The uncaught error
     * @param origin - The origin of the error
     */
    onUncaughtException?: (error: Error, origin: string) => void | Promise<void>;

    /**
     * Lifecycle hook called when an unhandled rejection occurs
     * @param reason - The rejection reason
     * @param promise - The promise that was rejected
     */
    onUnhandledRejection?: (reason: unknown, promise: Promise<unknown>) => void | Promise<void>;

    /**
     * Lifecycle hook called before the process exits
     * Useful for custom cleanup logic (close database, disconnect cache, etc.)
     */
    onBeforeExit?: () => void | Promise<void>;
}

/**
 * Sets up process error handlers to prevent app crashes and log errors properly
 * @param logger - Pino logger instance to use for logging
 * @param options - Configuration options
 */
export function setupProcessErrorHandlers(logger: pino.Logger, options: ProcessErrorHandlerOptions = {}): void {
    const {
        exitOnUncaughtException = false,
        exitOnUnhandledRejection = false,
        sentryFlushTimeout = 2000,
        handleUncaughtException = true,
        handleUnhandledRejection = true,
        handleWarnings = true,
        handleSigterm = true,
        handleSigint = true,
        onUncaughtException,
        onUnhandledRejection,
        onBeforeExit,
    } = options;

    /**
     * Helper to call onBeforeExit hook and exit process
     */
    const exitProcess = async (code: number): Promise<void> => {
        if (onBeforeExit) {
            try {
                await onBeforeExit();
            } catch (err) {
                logger.error({ err }, "Error in onBeforeExit hook");
            }
        }
        process.exit(code);
    };

    // Handle uncaught exceptions
    if (handleUncaughtException) {
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

            // Handle async operations synchronously to avoid memory leaks
            const handleException = async (): Promise<void> => {
                // Call custom hook if provided
                if (onUncaughtException) {
                    try {
                        await onUncaughtException(error, origin);
                    } catch (err) {
                        logger.error({ err }, "Error in onUncaughtException hook");
                    }
                }

                // Send to Sentry with high priority (if enabled)
                if (isSentryInitialized()) {
                    Sentry.captureException(error, {
                        level: "fatal",
                        tags: {
                            error_handler: "uncaughtException",
                            origin,
                        },
                    });

                    try {
                        await Sentry.flush(sentryFlushTimeout);
                        logger.info("Sentry flushed after uncaught exception");
                    } catch (err) {
                        logger.error({ err }, "Failed to flush Sentry");
                    }
                }

                if (exitOnUncaughtException) {
                    await exitProcess(1);
                } else {
                    logger.warn("Application continuing after uncaught exception (monitor for stability)");
                }
            };

            // Fire and forget with error handling
            handleException().catch((err) => {
                logger.error({ err }, "Critical error in uncaughtException handler");
                if (exitOnUncaughtException) {
                    process.exit(1);
                }
            });
        });
    }

    // Handle unhandled promise rejections
    if (handleUnhandledRejection) {
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

            const handleRejection = async (): Promise<void> => {
                // Call custom hook if provided
                if (onUnhandledRejection) {
                    try {
                        await onUnhandledRejection(reason, promise);
                    } catch (err) {
                        logger.error({ err }, "Error in onUnhandledRejection hook");
                    }
                }

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

                    if (exitOnUnhandledRejection) {
                        try {
                            await Sentry.flush(sentryFlushTimeout);
                        } catch (err) {
                            logger.error({ err }, "Failed to flush Sentry");
                        }
                    }
                }

                if (exitOnUnhandledRejection) {
                    await exitProcess(1);
                } else {
                    logger.warn("Application continuing after unhandled rejection");
                }
            };

            // Fire and forget with error handling
            handleRejection().catch((err) => {
                logger.error({ err }, "Critical error in unhandledRejection handler");
                if (exitOnUnhandledRejection) {
                    process.exit(1);
                }
            });
        });
    }

    // Handle process warnings
    if (handleWarnings) {
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
    }

    // Handle SIGTERM for graceful shutdown
    if (handleSigterm) {
        process.on("SIGTERM", () => {
            logger.info("SIGTERM signal received: closing HTTP server");

            const handleShutdown = async (): Promise<void> => {
                if (isSentryInitialized()) {
                    try {
                        await Sentry.flush(sentryFlushTimeout);
                    } catch (err) {
                        logger.error({ err }, "Failed to flush Sentry on SIGTERM");
                    }
                }
                await exitProcess(0);
            };

            handleShutdown().catch((err) => {
                logger.error({ err }, "Error during SIGTERM shutdown");
                process.exit(0);
            });
        });
    }

    // Handle SIGINT (Ctrl+C) for graceful shutdown
    if (handleSigint) {
        process.on("SIGINT", () => {
            logger.info("SIGINT signal received: closing HTTP server");

            const handleShutdown = async (): Promise<void> => {
                if (isSentryInitialized()) {
                    try {
                        await Sentry.flush(sentryFlushTimeout);
                    } catch (err) {
                        logger.error({ err }, "Failed to flush Sentry on SIGINT");
                    }
                }
                await exitProcess(0);
            };

            handleShutdown().catch((err) => {
                logger.error({ err }, "Error during SIGINT shutdown");
                process.exit(0);
            });
        });
    }

    logger.info(
        {
            handlers: {
                uncaughtException: handleUncaughtException,
                unhandledRejection: handleUnhandledRejection,
                warnings: handleWarnings,
                sigterm: handleSigterm,
                sigint: handleSigint,
            },
            exitPolicy: {
                uncaughtException: exitOnUncaughtException,
                unhandledRejection: exitOnUnhandledRejection,
            },
        },
        "Process error handlers configured"
    );
}
