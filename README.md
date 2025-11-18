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
import { initSentryForFastify, createLogger, setupProcessErrorHandlers, createErrorPipe, notFound } from "log-bundle";
import fastify from "fastify";

// 1. Initialize Sentry (optional, must be first)
if (process.env.SENTRY_DSN) {
  initSentryForFastify({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
  });
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

Use factory functions to create structured errors:

```typescript
import { notFound, validation, internal, unauthorized } from "log-bundle";

// 404 Not Found
const error = notFound("user", userId);

// 400 Validation Error
const error = validation("Email is required", "email");

// 500 Internal Error
const error = internal("Database connection failed");

// 401 Unauthorized
const error = unauthorized("Token expired");
```

Add context to errors:

```typescript
import { notFound, withContext } from "log-bundle";

let error = notFound("user", userId);
error = withContext(error, {
  requestId: "abc123",
  timestamp: new Date().toISOString(),
});
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
    // Error includes requestId, url, method, ip automatically
    return reply.code(404).send(errors.notFound("user", request.params.id));
  }

  return user;
});
```

### Sentry Integration

Initialize Sentry at the top of your entry file:

```typescript
import { initSentryForFastify } from "log-bundle";

initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  enableProfiling: true,
  tracesSampleRate: 0.1,
});
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

let error = notFound("user", userId);
error = withoutSentry(error);
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
notFound(resource: string, id?: unknown, context?: Record<string, any>): ErrorData
validation(message: string, field?: string, context?: Record<string, any>): ErrorData
internal(message: string, context?: Record<string, any>): ErrorData
// ... and more
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
initSentryForFastify(config: SentryInitConfig): void
isSentryInitialized(): boolean
sendToSentry(level: Level, logObj: any, message: string, options?: SentrySendOptions): void
```

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
