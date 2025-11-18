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

// Optimized timestamp function using template literals instead of multiple concatenations
const DEFAULT_TIMESTAMP = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    // Single template literal is much faster than multiple String() + padStart() calls
    return `,"time":"${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day} ${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}"`;
};

// Lazy initialization of default transport with reference counting
let cachedDefaultTransport: pino.DestinationStream | undefined;
let transportRefCount = 0;

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
    transportRefCount++;
    return cachedDefaultTransport;
}

/**
 * Release the default transport reference
 * Should be called when logger is no longer needed
 */
export function releaseDefaultTransport(): void {
    transportRefCount--;
    if (transportRefCount <= 0 && cachedDefaultTransport) {
        // Close the transport to release resources
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (typeof (cachedDefaultTransport as any).end === "function") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            (cachedDefaultTransport as any).end();
        }
        cachedDefaultTransport = undefined;
        transportRefCount = 0;
    }
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
