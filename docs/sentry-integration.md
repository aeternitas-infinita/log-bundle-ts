# Sentry Integration

log-bundle provides seamless integration with Sentry for error tracking, performance monitoring, and profiling in production applications.

## Quick Start

### Step 1: Install Sentry

```bash
npm install @sentry/node @sentry/profiling-node
```

### Step 2: Initialize Sentry

Initialize Sentry at the very top of your application entry point, before importing any other modules:

```typescript
// src/index.ts
import { initSentryForFastify } from "log-bundle";

initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
});

// Now import other modules
import fastify from "fastify";
// ...
```

## Configuration Options

### Basic Configuration

```typescript
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
});
```

### Advanced Configuration

```typescript
initSentryForFastify({
  // Required
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  // Performance monitoring
  tracesSampleRate: 0.1, // Sample 10% of transactions
  enableProfiling: true,
  profilesSampleRate: 0.1, // Sample 10% of profiles

  // Database instrumentation
  enablePostgres: true,

  // Security - redact sensitive headers
  redactHeaders: ["authorization", "cookie", "x-api-key", "x-api-token"],

  // Custom filter
  beforeSend: (event, hint) => {
    // Filter out specific errors
    if (event.exception?.values?.[0]?.type === "ValidationError") {
      return null; // Don't send to Sentry
    }
    return event;
  },
});
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
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  // Monitor 10% of requests
  tracesSampleRate: 0.1,

  // Enable database instrumentation
  enablePostgres: true,
});
```

This automatically tracks:
- HTTP request duration
- Database query performance
- External API calls
- Background jobs

## Profiling

Enable profiling to identify performance bottlenecks:

```typescript
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  enableProfiling: true,
  profilesSampleRate: 0.1, // Profile 10% of traces
});
```

Profiling captures:
- CPU usage
- Memory allocations
- Function call stacks
- Hot paths in code

## Database Instrumentation

Enable PostgreSQL instrumentation:

```typescript
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  enablePostgres: true,
});
```

This captures:
- Query execution time
- Query text (parameterized)
- Connection pool stats
- Slow query alerts

## Security Best Practices

### Redact Sensitive Headers

Always redact sensitive headers to prevent leaking credentials:

```typescript
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  redactHeaders: [
    "authorization",
    "cookie",
    "x-api-key",
    "x-api-token",
    "x-csrf-token",
  ],
});
```

### Don't Send PII

Avoid sending personally identifiable information:

```typescript
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  beforeSend: (event) => {
    // Remove sensitive data from context
    if (event.contexts?.user) {
      delete event.contexts.user.email;
      delete event.contexts.user.ip_address;
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
  initSentryForFastify({
    dsn: process.env.SENTRY_DSN!,
    environment: "development",
    tracesSampleRate: 1.0, // Sample all requests
    sendDefaultPii: true, // Useful for debugging
  });
}
```

### Production

```typescript
if (process.env.NODE_ENV === "production") {
  initSentryForFastify({
    dsn: process.env.SENTRY_DSN!,
    environment: "production",
    tracesSampleRate: 0.05, // Sample 5% of requests
    profilesSampleRate: 0.01, // Profile 1% of traces
    enableProfiling: true,
    enablePostgres: true,
  });
}
```

### Staging

```typescript
if (process.env.NODE_ENV === "staging") {
  initSentryForFastify({
    dsn: process.env.SENTRY_DSN!,
    environment: "staging",
    tracesSampleRate: 0.2, // Higher sampling for testing
    enableProfiling: false, // Disable to save quota
  });
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

initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,

  additionalIntegrations: [
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
import { initSentryForFastify } from "log-bundle";

initSentryForFastify({ ... });
```

```typescript
// GOOD - Sentry initialized first
import { initSentryForFastify } from "log-bundle";

initSentryForFastify({ ... });

import fastify from "fastify";
```

### Too Many Events

Reduce sample rates:

```typescript
initSentryForFastify({
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
