/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from "@sentry/node";
import * as pino from "pino";
import { logConfig } from "../../config.js";
import { getSource } from "../../helpers.js";

export function isSentryInitialized(): boolean {
    try {
        return Sentry.getCurrentScope() !== undefined && (logConfig.sentryInitialized || Sentry.getClient() !== undefined);
    } catch {
        return logConfig.sentryInitialized;
    }
}

export interface SentryHookOptions {
    level?: pino.Level;
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

const LEVEL_VALUES: Record<string, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
};

export function createSentryHook(options: SentryHookOptions = {}) {
    const { level = "error", captureContext = true, tags = {} } = options;

    const minLevelValue = LEVEL_VALUES[level] || 40;

    return {
        logMethod(this: pino.Logger, inputArgs: Parameters<pino.LogFn>, method: pino.LogFn, levelValue: number): void {
            if (!logConfig.sentryInitialized) {
                return method.apply(this, inputArgs);
            }

            if (levelValue < minLevelValue) {
                return method.apply(this, inputArgs);
            }

            const result = method.apply(this, inputArgs);

            try {
                const args = Array.from(inputArgs);
                const [first, ...rest] = args;
                let logObj: any = {};
                let message = "";

                if (typeof first === "string") {
                    message = first;
                    if (rest.length > 0 && typeof rest[0] === "object" && rest[0] !== null) {
                        logObj = rest[0];
                    }
                } else if (typeof first === "object" && first !== null) {
                    logObj = first;
                    message = (logObj as any).msg || (logObj as any).message || "Log message";
                }

                const source = getSource();

                const levelName = Object.keys(LEVEL_VALUES).find((key) => LEVEL_VALUES[key] === levelValue) || "info";

                const isError = levelValue >= 50 || logObj.err || logObj.error;
                const sentryLevel = PINO_TO_SENTRY_LEVEL[levelName] || "info";

                Sentry.withScope((scope) => {
                    scope.setLevel(sentryLevel);

                    Object.entries(tags).forEach(([key, value]) => {
                        scope.setTag(key, value);
                    });

                    scope.setTag("log.level", levelName);
                    scope.setTag("logger", "pino");

                    if (captureContext) {
                        const context: Record<string, any> = {};

                        Object.entries(logObj).forEach(([key, value]) => {
                            if (!["msg", "message", "level", "time", "err", "error", "stack"].includes(key)) {
                                context[key] = value;
                            }
                        });

                        if (Object.keys(context).length > 0) {
                            scope.setContext("log_data", context);
                        }
                    }

                    const sourceFromLog = logObj.source || source;
                    scope.setTag("source", sourceFromLog);

                    if (isError) {
                        const error = logObj.err || logObj.error;

                        if (error instanceof Error) {
                            Sentry.captureException(error);
                        } else if (error && typeof error === "object") {
                            const err = new Error(message || error.message || "Unknown error");
                            if (error.stack) {
                                err.stack = error.stack;
                            }
                            Sentry.captureException(err);
                        } else {
                            Sentry.captureMessage(message, sentryLevel);
                        }
                    } else {
                        Sentry.captureMessage(message, sentryLevel);
                    }
                });
            } catch (sentryError) {
                console.warn("Sentry hook error:", sentryError);
            }

            return result;
        },
    };
}
