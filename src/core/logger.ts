/* eslint-disable @typescript-eslint/no-explicit-any */
import * as pino from "pino";
import type { SentrySendOptions } from "../integrations/sentry/plugin.js";
import { sendToSentry } from "../integrations/sentry/plugin.js";
import { getSource } from "./helpers.js";

// Default serializers - created once to avoid repeated function allocations
const DEFAULT_SERIALIZERS: Record<string, pino.SerializerFn> = {
    stack: (stack: string | undefined) => {
        return stack ? stack.replace("Error", "").replace(/\n/g, "").trim().split("  at ") : undefined;
    },
};

// Default formatters - created once to avoid repeated object allocations
const DEFAULT_FORMATTERS = {
    level(label: string) {
        return { level: label.toUpperCase() };
    },
};

// Default timestamp function using native Date methods for better performance
const DEFAULT_TIMESTAMP = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `,"time":"${year}-${month}-${day} ${hours}:${minutes}:${seconds}"`;
};

// Lazy initialization of default transport to avoid creating it on module load
let cachedDefaultTransport: pino.DestinationStream | undefined;
function getDefaultTransport(): pino.DestinationStream {
    if (!cachedDefaultTransport) {
        cachedDefaultTransport = pino.transport({
            targets: [
                {
                    target: "pino-pretty",
                    options: {
                        translateTime: false,
                        colorize: true,
                    },
                },
            ],
        }) as pino.DestinationStream;
    }
    return cachedDefaultTransport;
}

export type LoggerConfig = pino.LoggerOptions;

/**
 * Extended logger type with Sentry integration methods
 */
export type LoggerWithSentry = {
    traceWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    debugWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    infoWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    warnWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    errorWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
    fatalWithSentry: (obj: any, msg?: string, options?: SentrySendOptions) => void;
} & pino.Logger;

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
 * Creates a pino logger with sensible defaults and Sentry integration
 * @param cfg - Logger configuration options
 * @param transport - Optional custom transport (uses pino-pretty by default)
 * @param addSource - Whether to add source location to logs (default: true)
 */
export function createLogger(
    cfg: LoggerConfig = {},
    transport: pino.DestinationStream | undefined = undefined,
    addSource = true
): LoggerWithSentry {
    const pinoOptions: pino.LoggerOptions = {
        serializers: DEFAULT_SERIALIZERS,
        timestamp: DEFAULT_TIMESTAMP,
        base: null,
        level: "warn",
        formatters: DEFAULT_FORMATTERS,
        ...cfg,
    };

    if (addSource) {
        pinoOptions.mixin = () => ({ source: getSource() });
    }

    const logger = pino.pino(pinoOptions, transport ?? getDefaultTransport());

    // Extend logger with Sentry methods
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
