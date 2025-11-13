# log-bundle

## Features

- **High-Performance Logging**: Built on Pino for structured, fast JSON logging
- **Sentry Integration**: Automatic error tracking with configurable reporting levels
- **Fastify Support**: Drop-in error handlers and error response pipes
- **Type-Safe**: Full TypeScript support with strict type checking
- **Flexible Error Handling**: Lightweight error data objects with HTTP status mapping
- **Zero Dependencies in Production**: Peer dependencies model keeps your bundle lean
- **ESM Only**: Modern ES modules for better tree-shaking and performance

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0.0

## Installation

```bash
npm install log-bundle
```

### Peer Dependencies

Install the dependencies you need based on your use case:

```bash
# Core logging only
npm install pino pino-pretty date-fns-tz

# With Sentry integration
npm install @sentry/node @sentry/profiling-node

# With Fastify support
npm install fastify
```

## Quick Start

### Basic Logger

```typescript
import { createLogger } from "log-bundle";

const logger = createLogger({
    name: "my-app",
    level: "info",
    environment: "production",
});

logger.info("Application started");
logger.error({ err: new Error("Something went wrong") }, "Error occurred");
```

### Logger with Sentry

```typescript
import { createLoggerWithSentry } from "log-bundle";
import * as Sentry from "@sentry/node";

// Initialize Sentry first
Sentry.init({
    dsn: "your-sentry-dsn",
    environment: "production",
});

const logger = createLoggerWithSentry({
    name: "my-app",
    level: "info",
    environment: "production",
});

// Errors are automatically sent to Sentry
logger.error({ err: new Error("Critical error") }, "This will be tracked in Sentry");
```

### Fastify Integration

```typescript
import Fastify from "fastify";
import { createLogger, createFastifyErrorHandler, createErrorPipe } from "log-bundle";

const logger = createLogger({
    name: "my-api",
    level: "info",
    environment: "production",
});

const fastify = Fastify({ logger });

// Global error handler
fastify.setErrorHandler(
    createFastifyErrorHandler({
        logger,
        environment: "production",
    })
);

// Error response pipe for route handlers
fastify.get("/users/:id", async (request, reply) => {
    const errorPipe = createErrorPipe({ reply, logger });

    const user = await getUserById(request.params.id).catch(errorPipe);

    if (!user) {
        return errorPipe(notFound("User not found"));
    }

    return { data: user };
});
```

## Core Concepts

### Error Data Objects

The library uses lightweight error data objects instead of throwable errors for better control flow:

```typescript
import { createErrorData, ErrorType, notFound, validation, internal } from "log-bundle";

// Create custom error data
const error = createErrorData({
    type: ErrorType.NOT_FOUND,
    message: "Resource not found",
    details: { resourceId: "123" },
});

// Use factory functions
const notFoundError = notFound("User not found");
const validationError = validation("Invalid email format", {
    field: "email",
    value: "invalid-email",
});
const internalError = internal("Database connection failed");
```

### Error Types and HTTP Status Mapping

Built-in error types with automatic HTTP status code mapping:

```typescript
import { ErrorType, getHttpStatus } from "log-bundle";

// Error types
ErrorType.VALIDATION; // 400 Bad Request
ErrorType.UNAUTHORIZED; // 401 Unauthorized
ErrorType.FORBIDDEN; // 403 Forbidden
ErrorType.NOT_FOUND; // 404 Not Found
ErrorType.CONFLICT; // 409 Conflict
ErrorType.INTERNAL; // 500 Internal Server Error
ErrorType.EXTERNAL; // 502 Bad Gateway
ErrorType.TIMEOUT; // 504 Gateway Timeout
ErrorType.DATABASE; // 500 Internal Server Error
```

### Process Error Handlers

Set up global handlers for unhandled errors:

```typescript
import { setupProcessErrorHandlers, createLogger } from "log-bundle";

const logger = createLogger({
    name: "my-app",
    level: "info",
    environment: "production",
});

setupProcessErrorHandlers({
    logger,
    exitOnUncaughtException: true,
    exitOnUnhandledRejection: false,
});
```

## Configuration

### Logger Configuration

```typescript
type LoggerConfig = {
    name: string; // Application name
    level?: string; // Log level: trace, debug, info, warn, error, fatal
    environment?: string; // Environment: development, production, test
    pretty?: boolean; // Enable pretty printing (auto-enabled in development)
    timezone?: string; // IANA timezone (default: UTC)
    destination?: string; // Log file path (optional)
};
```

### Sentry Configuration

Control which errors are sent to Sentry:

```typescript
import { errorConfig, shouldSendToSentry, ErrorType } from "log-bundle";

// Configure Sentry reporting
errorConfig.sentryReportLevels = {
    [ErrorType.INTERNAL]: true,
    [ErrorType.DATABASE]: true,
    [ErrorType.EXTERNAL]: false,
    [ErrorType.VALIDATION]: false,
    [ErrorType.NOT_FOUND]: false,
};

// Check if error should be sent to Sentry
const error = internal("Database connection failed");
if (shouldSendToSentry(error.type)) {
    // Send to Sentry
}
```

## Best Practices

### 1. Use Environment-Specific Configuration

```typescript
const logger = createLogger({
    name: "my-app",
    level: process.env.LOG_LEVEL || "info",
    environment: process.env.NODE_ENV || "development",
    pretty: process.env.NODE_ENV !== "production",
});
```

### 2. Structure Your Log Context

```typescript
// Good: Include relevant context
logger.info(
    {
        userId: user.id,
        action: "login",
        ip: request.ip,
    },
    "User logged in"
);

// Avoid: Logging sensitive data
logger.info({ password: "secret123" }, "Login attempt"); // DON'T DO THIS
```

### 3. Use Error Data Objects for Predictable Control Flow

```typescript
// Good: Explicit error handling
async function getUser(id: string) {
    const user = await db.findUser(id);
    if (!user) {
        return notFound("User not found");
    }
    return user;
}

// Then handle in your route
const result = await getUser(id);
if (isHttpError(result)) {
    return errorPipe(result);
}
return { data: result };
```

### 4. Configure Sentry Thresholds Appropriately

```typescript
// Only send critical errors to Sentry to avoid noise
errorConfig.sentryReportLevels = {
    [ErrorType.INTERNAL]: true, // Server bugs
    [ErrorType.DATABASE]: true, // Data layer issues
    [ErrorType.EXTERNAL]: false, // Third-party API failures (too noisy)
    [ErrorType.VALIDATION]: false, // User input errors (expected)
    [ErrorType.NOT_FOUND]: false, // Expected 404s
};
```

### 5. Use Child Loggers for Request Context

```typescript
fastify.addHook("onRequest", async (request, reply) => {
    request.log = logger.child({
        requestId: request.id,
        method: request.method,
        url: request.url,
    });
});
```

### 6. Handle Errors at the Right Level

```typescript
// Application-level errors
fastify.setErrorHandler(createFastifyErrorHandler({ logger, environment: "production" }));

// Process-level errors
setupProcessErrorHandlers({
    logger,
    exitOnUncaughtException: true,
    exitOnUnhandledRejection: process.env.NODE_ENV === "production",
});
```

## API Reference

### Core Functions

#### `createLogger(config: LoggerConfig)`

Creates a Pino logger instance with the specified configuration.

#### `createLoggerWithSentry(config: LoggerConfig)`

Creates a logger with automatic Sentry integration. Requires Sentry to be initialized first.

### Error Factories

All factory functions return an `ErrorData` object:

- `validation(message, details?)` - 400 Bad Request
- `unauthorized(message, details?)` - 401 Unauthorized
- `forbidden(message, details?)` - 403 Forbidden
- `notFound(message, details?)` - 404 Not Found
- `conflict(message, details?)` - 409 Conflict
- `internal(message, details?)` - 500 Internal Server Error
- `external(message, details?)` - 502 Bad Gateway
- `timeout(message, details?)` - 504 Gateway Timeout
- `database(message, details?)` - 500 Internal Server Error

### Fastify Integration

#### `createFastifyErrorHandler(options)`

Creates a Fastify error handler that processes both ErrorData objects and standard Error instances.

#### `createErrorPipe(options)`

Creates an error pipe function for route handlers that automatically logs and responds to errors.

### Utility Functions

#### `isHttpError(value: unknown): value is HttpError`

Type guard to check if a value is an HttpError.

#### `getHttpStatus(type: ErrorType): number`

Returns the HTTP status code for an error type.

#### `toHttpResponse(error: ErrorData)`

Converts an ErrorData object to an HTTP response object.

#### `shouldSendToSentry(type: ErrorType): boolean`

Checks if an error type should be reported to Sentry.

## Performance Considerations

1. **Pino's Speed**: Pino is one of the fastest Node.js loggers, with minimal performance overhead
2. **Structured Logging**: JSON logs are machine-readable and easier to query in log aggregation tools
3. **Lazy Evaluation**: Log objects are only serialized if the log level is enabled
4. **Async Logging**: Pino uses async operations to minimize I/O blocking
5. **Tree-Shaking**: ESM modules allow bundlers to remove unused code

## TypeScript

This library is written in TypeScript and provides full type definitions. All exports are fully typed.

```typescript
import type { LoggerConfig, ErrorData, HttpError, FastifyErrorHandlerOptions } from "log-bundle";
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## Support

- Issues: <https://github.com/aeternitas-infinita/log-bundle-ts/issues>
- Discussions: <https://github.com/aeternitas-infinita/log-bundle-ts/discussions>
