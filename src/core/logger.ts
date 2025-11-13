import { format } from "date-fns-tz";
import * as pino from "pino";
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

// Default timestamp function
const DEFAULT_TIMESTAMP = () => `,"time":"${format(new Date(), "yyyy-MM-dd HH:mm:ss")}"`;

// Default transport configuration
const DEFAULT_TRANSPORT = pino.transport({
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

export type LoggerConfig = pino.LoggerOptions;

/**
 * Creates a pino logger with sensible defaults
 * @param cfg - Logger configuration options
 * @param transport - Optional custom transport (uses pino-pretty by default)
 * @param addSource - Whether to add source location to logs (default: true)
 */
export function createLogger(cfg: LoggerConfig = {}, transport: pino.DestinationStream | undefined = undefined, addSource = true): pino.Logger {
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

    return pino.pino(pinoOptions, transport ?? (DEFAULT_TRANSPORT as pino.DestinationStream));
}
