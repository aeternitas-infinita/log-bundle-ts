# log-bundle

Production-ready logging and error handling library for Node.js with Pino, Sentry, and Fastify integration.

## Features

- **Structured Logging** - Built on Pino for high-performance JSON logging
- **Error Handling** - RFC 7807 compliant error responses with predefined error types
- **Sentry Integration** - Automatic error tracking and performance monitoring
- **Fastify Support** - First-class Fastify middleware and error handlers
- **Type Safety** - Full TypeScript support with comprehensive types
- **Zero Config** - Sensible defaults that work out of the box
- **Production Ready** - Optimized for performance and reliability

## Installation

```bash
npm install log-bundle
```

Optional peer dependencies:

```bash
npm install @sentry/node fastify
```

## Quick Start

```typescript
import * as Sentry from "@sentry/node";
import { logConfig, createLogger, setupProcessErrorHandlers, createErrorPipe, notFound } from "log-bundle";
import fastify from "fastify";

// 1. Initialize Sentry (optional, must be first)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });
  logConfig.enableSentry = true;
}

// 2. Create logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
});

// 3. Setup process error handlers
setupProcessErrorHandlers(logger);

// 4. Create Fastify app
const app = fastify({ logger });

// 5. Define routes
app.get("/users/:id", async (request, reply) => {
  const user = await db.users.findById(request.params.id);

  if (!user) {
    return reply.code(404).send(notFound("user", request.params.id));
  }

  return user;
});

// 6. Setup error handler (must be last)
app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
  })
);

// 7. Start server
await app.listen({ port: 3000 });
```

## Core Concepts

### Logging

Create a logger with Pino integration:

```typescript
import { createLogger } from "log-bundle";

const logger = createLogger({
  level: "info",
});

logger.info("Application started");
logger.warn({ userId: "123" }, "Suspicious activity");
logger.error(error, "Failed to process request");
```

Log and send to Sentry simultaneously:

```typescript
logger.errorWithSentry(
  { userId: "123", action: "payment" },
  "Payment processing failed"
);
```

### Error Handling

Use factory functions to create structured errors with clear separation of public (user-facing) and internal (logs/Sentry) data:

```typescript
import { notFound, validation, internal, database } from "log-bundle";

// Simple errors - basic usage
const error = notFound("user", userId);
const error = validation("Email is required", "email");

// Add internal context (for logs/Sentry only)
const error = notFound("user", userId, {
  internal: { context: { requestId: "abc123", ip: "192.168.1.1" } }
});

// Add public metadata (sent to users)
const error = notFound("user", userId, {
  public: { meta: { suggestion: "Check the user ID format" } }
});

// Capture original errors for Sentry
try {
  await db.query();
} catch (err) {
  const error = database("Query failed", {
    public: { detail: "Unable to fetch data" },
    internal: {
      cause: err, // Original error goes to Sentry only
      context: { query: "SELECT * FROM users", params: { id: userId } }
    }
  });
}
```

Add context using utilities:

```typescript
import { notFound, withContext } from "log-bundle";

let error = notFound("user", userId);
error = withContext(error, {
  requestId: "abc123",
  timestamp: new Date().toISOString(),
}); // Adds to internal.context
```

### Fastify Integration

The middleware order matters. Here's the correct setup:

```typescript
import fastify from "fastify";
import { createLogger, createErrorPipe } from "log-bundle";

const app = fastify({ logger: createLogger() });

// 1. Register plugins
await app.register(import("@fastify/cors"));

// 2. Register routes
app.get("/", async () => ({ hello: "world" }));

// 3. Register error handler (MUST BE LAST)
app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
  })
);
```

Use ErrorFactory for automatic request context:

```typescript
import { ErrorFactory } from "log-bundle";

app.get("/users/:id", async (request, reply) => {
  const errors = ErrorFactory.forRequest(request);

  const user = await db.users.findById(request.params.id);

  if (!user) {
    // Error automatically includes requestId, url, method, ip in internal context
    return reply.code(404).send(errors.notFound("user", request.params.id));
  }

  return user;
});

// You can also pass additional options
app.post("/users", async (request, reply) => {
  const errors = ErrorFactory.forRequest(request);

  try {
    const user = await db.users.create(request.body);
    return user;
  } catch (err) {
    return reply.code(500).send(
      errors.database("Failed to create user", {
        internal: { cause: err }, // Original error for Sentry
        public: { detail: "Unable to create user account" }
      })
    );
  }
});
```

### Sentry Integration

Initialize Sentry at the top of your entry file:

```typescript
import * as Sentry from "@sentry/node";
import { logConfig } from "log-bundle";

Sentry.init({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  tracesSampleRate: 0.1,
});

logConfig.enableSentry = true;
```

Control what gets sent to Sentry:

```typescript
import { errorConfig } from "log-bundle";

// Only send specific status codes
errorConfig.setSentryStatusCodes([500, 502, 503, 504]);
```

Skip Sentry for specific errors:

```typescript
import { withoutSentry, notFound } from "log-bundle";

// Using utility
let error = notFound("user", userId);
error = withoutSentry(error);

// Or directly in factory
const error = notFound("user", userId, { skipSentry: true });
```

### Process Error Handlers

Catch uncaught exceptions and rejections:

```typescript
import { setupProcessErrorHandlers } from "log-bundle";

setupProcessErrorHandlers(logger, {
  exitOnUncaughtException: process.env.NODE_ENV === "production",
  exitOnUnhandledRejection: false,
  onBeforeExit: async () => {
    await db.close();
    await cache.disconnect();
  },
});
```

## Available Error Types

| Function | HTTP Status | Use Case |
|----------|-------------|----------|
| `notFound(resource, id)` | 404 | Resource not found |
| `validation(message, field)` | 400 | Input validation failure |
| `badInput(message)` | 400 | Malformed request data |
| `unauthorized(reason)` | 401 | Authentication required |
| `forbidden(resource, reason)` | 403 | Permission denied |
| `conflict(resource, reason)` | 409 | Resource conflict |
| `internal(message)` | 500 | Internal server error |
| `database(message)` | 500 | Database operation failure |
| `external(service, message)` | 502 | External service failure |
| `timeout(operation, duration)` | 504 | Operation timeout |
| `busy(message)` | 503 | Service unavailable |

## API Reference

### Logger

```typescript
createLogger(config?: LoggerConfig, transport?: DestinationStream, addSource?: boolean): LoggerWithSentry
```

### Error Factories

```typescript
notFound(resource: string, id?: unknown, options?: CreateErrorDataOptions): ErrorData
validation(message: string, field?: string, options?: CreateErrorDataOptions): ErrorData
database(message: string, options?: CreateErrorDataOptions): ErrorData
internal(message: string, options?: CreateErrorDataOptions): ErrorData
// ... and more

// CreateErrorDataOptions:
type CreateErrorDataOptions = {
  public?: {
    title?: string;
    detail?: string;
    instance?: string;
    meta?: Record<string, unknown>;
    validationErrors?: ValidationError[];
  };
  internal?: {
    cause?: Error;
    context?: Record<string, unknown>;
    tags?: Record<string, string>;
  };
  httpStatus?: number;
  skipSentry?: boolean;
}
```

### Error Utilities

```typescript
toHttpResponse(error: ErrorData): { statusCode: number; body: ErrorResponse }
toErrorResponse(error: ErrorData, baseUrl?: string): ErrorResponse
withContext(error: ErrorData, context: Record<string, unknown>): ErrorData
withHttpStatus(error: ErrorData, statusCode: number): ErrorData
withoutSentry(error: ErrorData): ErrorData
isClientError(error: ErrorData): boolean
isServerError(error: ErrorData): boolean
```

### Fastify Handlers

```typescript
createErrorPipe(logger: Logger, options?: ErrorPipeOptions): FastifyErrorHandler
createFastifyErrorHandler(logger: Logger, options?: FastifyErrorHandlerOptions): FastifyErrorHandler
```

### Sentry

```typescript
isSentryInitialized(): boolean
sendToSentry(level: Level, logObj: any, message: string, options?: SentrySendOptions): void
```

Note: Initialize Sentry using `@sentry/node` directly, then enable it with `logConfig.enableSentry = true`.

### Process Handlers

```typescript
setupProcessErrorHandlers(logger: Logger, options?: ProcessErrorHandlerOptions): void
```

## Documentation

- [Getting Started](./docs/getting-started.md) - Detailed setup guide
- [Error Handling](./docs/error-handling.md) - Complete error handling guide
- [Fastify Integration](./docs/fastify-integration.md) - Fastify middleware order and best practices
- [Sentry Integration](./docs/sentry-integration.md) - Sentry configuration and security

## Examples

See the [examples](./examples) directory for complete working examples:

- Basic setup with Fastify
- Error handling patterns
- Sentry integration
- Advanced configuration

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0 (for TypeScript projects)

## Performance

log-bundle is optimized for production use:

- **Zero overhead** when features are disabled
- **Lazy initialization** of expensive resources
- **Native Date methods** for timestamp generation (no external dependencies)
- **Pre-compiled regexes** and cached values
- **Optimized string operations** in hot paths

## Contributing

Contributions are welcome! Please read the [contributing guidelines](./CONTRIBUTING.md) before submitting PRs.

## License

MIT

## Author

aeternitas-infinita

## Repository

https://github.com/aeternitas-infinita/log-bundle-ts
