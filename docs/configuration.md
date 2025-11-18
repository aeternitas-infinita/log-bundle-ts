# Configuration

This guide covers all configuration options available in log-bundle.

## Logger Configuration

### Basic Logger

```typescript
import { createLogger } from "log-bundle";

const logger = createLogger({
  level: "info",
});
```

### Custom Log Levels

```typescript
const logger = createLogger({
  level: "debug", // trace, debug, info, warn, error, fatal
});
```

### Disable Source Location

By default, log-bundle adds source location to each log entry. Disable for better performance:

```typescript
const logger = createLogger(
  {
    level: "info",
  },
  undefined,
  false // addSource = false
);
```

### Custom Pino Options

Pass any Pino configuration:

```typescript
const logger = createLogger({
  level: "info",
  serializers: {
    user: (user) => ({
      id: user.id,
      name: user.name,
      // Omit sensitive fields
    }),
  },
  redact: {
    paths: ["password", "apiKey", "token"],
    censor: "[REDACTED]",
  },
});
```

### Custom Transport

Use a custom Pino transport:

```typescript
import * as pino from "pino";

const transport = pino.transport({
  targets: [
    {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
      },
    },
    {
      target: "pino/file",
      options: {
        destination: "./logs/app.log",
      },
    },
  ],
});

const logger = createLogger({}, transport);
```

## Global Configuration

### Log Bundle Config

Control Sentry globally:

```typescript
import { logConfig } from "log-bundle";

// Enable Sentry (done automatically by initSentryForFastify)
logConfig.enableSentry = true;

// Disable Sentry temporarily
logConfig.enableSentry = false;
```

### Error Config

Configure error handling behavior:

```typescript
import { errorConfig, ErrorType } from "log-bundle";

// Customize HTTP status codes
errorConfig.setCustomStatusMap({
  [ErrorType.NOT_FOUND]: 410, // Gone instead of Not Found
  [ErrorType.BUSY]: 429, // Too Many Requests
});

// Configure which status codes go to Sentry (using ranges)
// Default: [[500, 599]] (all 5xx errors)

// Send all 5xx errors (default)
errorConfig.setSentryStatusRules([[500, 599]]);

// Send all 4xx and 5xx errors
errorConfig.setSentryStatusRules([[400, 499], [500, 599]]);

// Send specific status codes only
errorConfig.setSentryStatusRules([500, 502, 503, 504]);

// Send all 5xx except proxy/gateway errors
errorConfig.setSentryStatusRules([
  { range: [500, 599], exclude: [502, 503, 504] }
]);

// Mix ranges and specific codes (e.g., rate limits + all 5xx)
errorConfig.setSentryStatusRules([429, [500, 599]]);

// Register custom error types
errorConfig.registerErrorType("rate_limited", 429);

// Reset to defaults
errorConfig.reset();
```

## Sentry Configuration

### Minimal Setup

```typescript
import * as Sentry from "@sentry/node";
import { logConfig } from "log-bundle";

Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
});

logConfig.enableSentry = true;
```

### Complete Configuration

```typescript
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logConfig } from "log-bundle";

Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  // Performance monitoring
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  // Integrations
  integrations: [
    Sentry.httpIntegration(),
    nodeProfilingIntegration(),
    Sentry.postgresIntegration(),
    Sentry.prismaIntegration(),
    Sentry.redisIntegration(),
  ],

  // Security and filtering
  beforeSend: (event, hint) => {
    // Filter errors
    if (hint?.originalException?.name === "ValidationError") {
      return null;
    }

    // Redact headers
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    return event;
  },
});

logConfig.enableSentry = true;
```

### Environment-Specific

```typescript
import * as Sentry from "@sentry/node";
import { logConfig } from "log-bundle";

if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN!,
    environment: "production",
    tracesSampleRate: 0.05,
    profilesSampleRate: 0.01,
  });
  logConfig.enableSentry = true;
} else if (process.env.NODE_ENV === "development") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN!,
    environment: "development",
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
  });
  logConfig.enableSentry = true;
}
```

## Fastify Error Handler Configuration

### Error Pipe (Recommended)

```typescript
import { createErrorPipe } from "log-bundle";

app.setErrorHandler(
  createErrorPipe(logger, {
    // Environment
    environment: process.env.NODE_ENV,

    // Show detailed errors in dev
    includeErrorDetails: process.env.NODE_ENV !== "production",

    // Security - redact headers
    redactHeaders: [
      "authorization",
      "cookie",
      "x-api-key",
      "x-csrf-token",
    ],

    // Capture request body (be careful with sensitive data)
    captureRequestBody: false,
  })
);
```

### Legacy Error Handler

```typescript
import { createFastifyErrorHandler } from "log-bundle";

app.setErrorHandler(
  createFastifyErrorHandler(logger, {
    includeErrorDetails: process.env.NODE_ENV !== "production",
    environment: process.env.NODE_ENV,

    redactHeaders: ["authorization", "cookie"],

    customStatusCodes: {
      ValidationError: 422,
      RateLimitError: 429,
    },
  })
);
```

## Process Error Handler Configuration

### Basic Setup

```typescript
import { setupProcessErrorHandlers } from "log-bundle";

setupProcessErrorHandlers(logger);
```

### Complete Configuration

```typescript
setupProcessErrorHandlers(logger, {
  // Exit behavior
  exitOnUncaughtException: process.env.NODE_ENV === "production",
  exitOnUnhandledRejection: false,

  // Sentry flush timeout
  sentryFlushTimeout: 2000, // milliseconds

  // Handler toggles
  handleUncaughtException: true,
  handleUnhandledRejection: true,
  handleWarnings: true,
  handleSigterm: true,
  handleSigint: true,

  // Lifecycle hooks
  onUncaughtException: async (error, origin) => {
    // Custom cleanup or notification
    await sendSlackNotification("Critical error", error);
  },

  onUnhandledRejection: async (reason, promise) => {
    // Custom handling
    await logToExternalService(reason);
  },

  onBeforeExit: async () => {
    // Cleanup resources
    await db.close();
    await redis.quit();
    await messageQueue.disconnect();
  },
});
```

### Production Recommendations

```typescript
setupProcessErrorHandlers(logger, {
  exitOnUncaughtException: true, // Exit on fatal errors
  exitOnUnhandledRejection: false, // Log but don't exit
  sentryFlushTimeout: 3000, // Give Sentry time to send

  onBeforeExit: async () => {
    // Graceful shutdown
    await app.close();
    await db.close();
  },
});
```

## Environment Variables

Recommended environment variables:

```bash
# Application
NODE_ENV=production
LOG_LEVEL=info

# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1

# Feature flags
ENABLE_PROFILING=true
ENABLE_REQUEST_BODY_CAPTURE=false
```

Use in configuration:

```typescript
import * as Sentry from "@sentry/node";
import { logConfig, createLogger } from "log-bundle";

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
});

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV!,
    tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || "0.1"),
  });
  logConfig.enableSentry = true;
}
```

## Configuration Best Practices

### Separate Configs by Environment

```typescript
// config/logger.ts
export const getLoggerConfig = () => {
  const base = {
    level: process.env.LOG_LEVEL || "info",
  };

  if (process.env.NODE_ENV === "development") {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    };
  }

  return base;
};

// Usage
const logger = createLogger(getLoggerConfig());
```

### Use Config Validation

```typescript
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "staging"]),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]),
  SENTRY_DSN: z.string().url().optional(),
});

const config = configSchema.parse(process.env);
```

### Centralize Configuration

```typescript
// config/index.ts
export const config = {
  env: process.env.NODE_ENV as string,
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",

  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableSource: process.env.NODE_ENV !== "production",
  },

  sentry: {
    enabled: !!process.env.SENTRY_DSN,
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || "0.1"),
  },
};

// Usage
const logger = createLogger({
  level: config.logging.level,
}, undefined, config.logging.enableSource);
```

## Performance Tuning

### Reduce Log Level in Production

```typescript
const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
});
```

### Disable Source Location

```typescript
const logger = createLogger(
  { level: "info" },
  undefined,
  process.env.NODE_ENV !== "production" // Only in dev
);
```

### Lower Sentry Sample Rates

```typescript
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  tracesSampleRate: 0.01, // 1% of requests
  profilesSampleRate: 0.001, // 0.1% of traces
});
```

### Optimize Error Context

```typescript
// Don't capture unnecessary context
app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
    captureRequestBody: false, // Saves bandwidth
    redactHeaders: ["authorization"], // Only redact what's needed
  })
);
```

## Next Steps

- [Getting Started](./getting-started.md) - Setup guide
- [Error Handling](./error-handling.md) - Error types and patterns
- [Fastify Integration](./fastify-integration.md) - Middleware setup
- [Sentry Integration](./sentry-integration.md) - Error tracking
