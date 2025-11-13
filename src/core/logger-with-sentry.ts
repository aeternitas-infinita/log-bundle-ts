/* eslint-disable @typescript-eslint/no-explicit-any */
import type * as pino from "pino";
import type { SentrySendOptions } from "../integrations/sentry/plugin.js";
import { sendToSentry } from "../integrations/sentry/plugin.js";

export type LoggerWithSentry = {
    traceWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    debugWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    infoWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    warnWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    errorWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    fatalWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
} & pino.Logger

/**
 * Creates a combined log+Sentry method for a specific log level
 * Optimized to avoid repeated binding and function creation
 */
function createLogWithSentryMethod(level: pino.Level, logFn: pino.LogFn) {
    return function (obj: any, msg?: string, options?: SentrySendOptions): void {
        let logObj = obj;
        let logMsg = msg;
        let sentryOptions = options;

        // If first arg is string, treat it as message
        if (typeof obj === "string") {
            sentryOptions = msg as any;
            logMsg = obj;
            logObj = {};
        }

        // Log with pino
        if (logMsg) {
            logFn(logObj, logMsg);
        } else {
            logFn(logObj);
        }

        // Send to Sentry
        sendToSentry(level, logObj, logMsg ?? "", sentryOptions);
    };
}

/**
 * Extends a pino logger with methods that log and send to Sentry in one call
 * @param logger - The base pino logger to extend
 * @returns Extended logger with *WithSentry methods
 */
export function createLoggerWithSentry(logger: pino.Logger): LoggerWithSentry {
    const extendedLogger = logger as LoggerWithSentry;

    // Pre-bind logger methods to avoid repeated binding
    extendedLogger.traceWithSentry = createLogWithSentryMethod("trace", logger.trace.bind(logger));
    extendedLogger.debugWithSentry = createLogWithSentryMethod("debug", logger.debug.bind(logger));
    extendedLogger.infoWithSentry = createLogWithSentryMethod("info", logger.info.bind(logger));
    extendedLogger.warnWithSentry = createLogWithSentryMethod("warn", logger.warn.bind(logger));
    extendedLogger.errorWithSentry = createLogWithSentryMethod("error", logger.error.bind(logger));
    extendedLogger.fatalWithSentry = createLogWithSentryMethod("fatal", logger.fatal.bind(logger));

    return extendedLogger;
}
