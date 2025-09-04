import { format } from "date-fns-tz";
import * as pino from "pino";
import { getSource } from "./helpers.js";
import type { SentryHookOptions } from "./plugins/sentry/sentry.js";
import { createSentryHook } from "./plugins/sentry/sentry.js";

function getDefaultSerializers(): Record<string, pino.SerializerFn> {
    return {
        stack: (stack: string | undefined) => {
            return stack ? stack.replace("Error", "").replace(/\n/g, "").trim().split("  at ") : undefined;
        },
    };
}

function getDefaultFormatters(): {
    level?: (label: string, number: number) => object;
    bindings?: (bindings: pino.Bindings) => object;
    log?: (object: Record<string, unknown>) => Record<string, unknown>;
} {
    return {
        level(label) {
            return { level: label.toUpperCase() };
        },
    };
}

function getDefaultTimestamp() {
    return () => `,"time":"${format(new Date(), "yyyy-MM-dd HH:mm:ss")}"`;
}

function getDefaultTransport(): unknown {
    return pino.transport({
        targets: [
            {
                target: "pino-pretty",
                options: {
                    translateTime: false,
                    colorize: true,
                },
            },
        ],
    });
}

export interface LoggerConfig extends pino.LoggerOptions {
    sentryEnabled?: boolean;
    sentryOptions?: SentryHookOptions;
}

export function createLogger(cfg: LoggerConfig = {}, transport: pino.DestinationStream | undefined = undefined, addSource = true): pino.Logger {
    const { sentryEnabled = false, sentryOptions = {}, ...pinoOptions } = cfg;

    if (pinoOptions.serializers === undefined) {
        pinoOptions.serializers = getDefaultSerializers();
    }
    if (pinoOptions.timestamp === undefined) {
        pinoOptions.timestamp = getDefaultTimestamp();
    }
    if (pinoOptions.base === undefined) {
        pinoOptions.base = null;
    }
    if (pinoOptions.level === undefined) {
        pinoOptions.level = "warn";
    }
    if (pinoOptions.formatters === undefined) {
        pinoOptions.formatters = getDefaultFormatters();
    }

    if (addSource === true) {
        pinoOptions.mixin = () => ({ source: getSource() });
    }

    if (sentryEnabled === true) {
        const sentryHook = createSentryHook(sentryOptions);
        pinoOptions.hooks = {
            ...pinoOptions.hooks,
            ...sentryHook,
        };
    }

    if (transport === undefined) {
        transport = getDefaultTransport() as pino.DestinationStream;
    }

    return pino.pino(pinoOptions, transport);
}
