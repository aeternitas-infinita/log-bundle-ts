# Sentry Integration

log-bundle works seamlessly with Sentry for error tracking, performance monitoring, and profiling in production applications.

## Quick Start

### Step 1: Install Sentry

```bash
npm install @sentry/node @sentry/profiling-node
```

### Step 2: Initialize Sentry

Initialize Sentry at the very top of your application entry point, before importing any other modules:

```typescript
// src/index.ts
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logConfig } from "log-bundle";

// Initialize Sentry first
Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  tracesSampleRate: 0.1,
  integrations: [
    Sentry.httpIntegration(),
    nodeProfilingIntegration(),
  ],
});

// Enable Sentry in log-bundle
logConfig.enableSentry = true;

// Now import other modules
import fastify from "fastify";
// ...
```

## Configuration Options

### Basic Configuration

```typescript
import * as Sentry from "@sentry/node";
import { logConfig } from "log-bundle";

Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
});

logConfig.enableSentry = true;
```

### Advanced Configuration

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
    Sentry.requestDataIntegration({
      include: {
        cookies: false,
        data: true,
        headers: true,
        ip: true,
      },
    }),
    nodeProfilingIntegration(),
    Sentry.postgresIntegration(),
  ],

  // Custom filter
  beforeSend: (event, hint) => {
    // Filter out validation errors
    if (hint?.originalException?.name === "ZodError") {
      return null;
    }

    // Redact sensitive headers
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    return event;
  },
});

// Enable Sentry in log-bundle
logConfig.enableSentry = true;
```

## What Gets Sent to Sentry

### Automatic Capture

The library automatically sends the following to Sentry:

1. **Server errors (5xx)** - All 500-level errors are captured
2. **Uncaught exceptions** - Process-level uncaught exceptions
3. **Unhandled rejections** - Unhandled promise rejections
4. **Fatal errors** - Critical application errors

### Manual Capture

You can manually send logs to Sentry using `logWithSentry` methods:

```typescript
import { createLogger } from "log-bundle";

const logger = createLogger();

// Log and send to Sentry
logger.errorWithSentry(
  { userId: "123", action: "payment" },
  "Payment processing failed"
);

// With custom tags
logger.errorWithSentry(
  { userId: "123" },
  "Payment failed",
  {
    tags: {
      payment_provider: "stripe",
      amount: "100",
    },
  }
);
```

### Client Errors (4xx)

By default, client errors (4xx) are not sent to Sentry. You can customize this:

```typescript
import { errorConfig } from "log-bundle";

// Send specific 4xx errors to Sentry
errorConfig.setSentryStatusCodes([
  401, // Unauthorized - auth issues
  403, // Forbidden - permission issues
  500, 502, 503, 504, // All 5xx
]);
```

## Controlling What Gets Sent

### Skip Sentry for Specific Errors

```typescript
import { withoutSentry, notFound } from "log-bundle";

// This error won't be sent to Sentry
let error = notFound("user", userId);
error = withoutSentry(error);
```

### Filter in beforeSend

```typescript
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  beforeSend: (event, hint) => {
    const exception = hint?.originalException;

    // Don't send Zod validation errors
    if (exception?.name === "ZodError") {
      return null;
    }

    // Don't send specific error types
    if (event.message?.includes("ECONNREFUSED")) {
      return null;
    }

    // Filter by status code
    const status = event.contexts?.response?.status_code;
    if (status === 404) {
      return null;
    }

    return event;
  },
});
```

## Request Context

The error handlers automatically capture request context:

```typescript
{
  url: "/api/users/123",
  method: "GET",
  query: { filter: "active" },
  params: { id: "123" },
  headers: {
    "user-agent": "...",
    // Sensitive headers are redacted automatically
  },
  ip: "192.168.1.1"
}
```

## Performance Monitoring

Enable traces to monitor application performance:

```typescript
import * as Sentry from "@sentry/node";
import { logConfig } from "log-bundle";

Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  tracesSampleRate: 0.1, // Monitor 10% of requests
  integrations: [
    Sentry.httpIntegration(),
    Sentry.postgresIntegration(), // Database instrumentation
  ],
});

logConfig.enableSentry = true;
```

This automatically tracks:
- HTTP request duration
- Database query performance
- External API calls
- Background jobs

## Profiling

Enable profiling to identify performance bottlenecks:

```typescript
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1, // Profile 10% of traces
  integrations: [
    nodeProfilingIntegration(),
  ],
});
```

Profiling captures:
- CPU usage
- Memory allocations
- Function call stacks
- Hot paths in code

## Security Best Practices

### Redact Sensitive Headers

Always redact sensitive headers to prevent leaking credentials:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  beforeSend: (event) => {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers["x-api-key"];
    }
    return event;
  },
});
```

### Don't Send PII

Avoid sending personally identifiable information:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  beforeSend: (event) => {
    // Remove sensitive user data
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    // Remove sensitive request data
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.ssn;
    }

    return event;
  },
});
```

### Control Request Body Capture

By default, request bodies are not sent to Sentry. Enable only when safe:

```typescript
import { createErrorPipe } from "log-bundle";

app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
    captureRequestBody: false, // Recommended: false
  })
);
```

## Environment-Specific Configuration

### Development

```typescript
if (process.env.NODE_ENV === "development") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN!,
    environment: "development",
    tracesSampleRate: 1.0, // Sample all requests
    sendDefaultPii: true, // Useful for debugging
  });

  logConfig.enableSentry = true;
}
```

### Production

```typescript
if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN!,
    environment: "production",
    tracesSampleRate: 0.05, // Sample 5%
    profilesSampleRate: 0.01, // Profile 1%
    integrations: [
      Sentry.httpIntegration(),
      nodeProfilingIntegration(),
      Sentry.postgresIntegration(),
    ],
  });

  logConfig.enableSentry = true;
}
```

### Staging

```typescript
if (process.env.NODE_ENV === "staging") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN!,
    environment: "staging",
    tracesSampleRate: 0.2, // Higher sampling for testing
  });

  logConfig.enableSentry = true;
}
```

## Testing Without Sentry

Disable Sentry in tests:

```typescript
// test/setup.ts
process.env.SENTRY_DSN = undefined;

// Or use a test DSN that doesn't send data
process.env.SENTRY_DSN = "https://public@invalid.ingest.sentry.io/0";
```

## Checking Sentry Status

```typescript
import { isSentryInitialized } from "log-bundle";

if (isSentryInitialized()) {
  console.log("Sentry is active");
} else {
  console.log("Sentry is not initialized");
}
```

## Custom Integrations

Add custom Sentry integrations:

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.prismaIntegration(),
    Sentry.redisIntegration(),
  ],
});
```

## Flushing on Shutdown

The library automatically flushes Sentry on process shutdown:

```typescript
import { setupProcessErrorHandlers } from "log-bundle";

setupProcessErrorHandlers(logger, {
  sentryFlushTimeout: 2000, // Wait 2s for Sentry to flush
});
```

## Troubleshooting

### Sentry Not Capturing Errors

Check initialization order:

```typescript
// BAD - Sentry initialized after imports
import fastify from "fastify";
import * as Sentry from "@sentry/node";

Sentry.init({ ... });
```

```typescript
// GOOD - Sentry initialized first
import * as Sentry from "@sentry/node";
import { logConfig } from "log-bundle";

Sentry.init({ ... });
logConfig.enableSentry = true;

import fastify from "fastify";
```

### Too Many Events

Reduce sample rates:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  tracesSampleRate: 0.01, // 1% instead of 10%
});
```

### Missing Request Context

Ensure error handler is properly configured:

```typescript
import { createErrorPipe } from "log-bundle";

app.setErrorHandler(createErrorPipe(logger, {
  environment: process.env.NODE_ENV,
}));
```

## Next Steps

- [Error Handling](./error-handling.md) - Learn about error types
- [Configuration](./configuration.md) - Advanced configuration
- [Fastify Integration](./fastify-integration.md) - Fastify setup
