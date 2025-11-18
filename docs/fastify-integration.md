# Fastify Integration

This guide covers how to properly integrate log-bundle with Fastify, including the correct middleware order and configuration.

## Middleware Order

The order in which you register middleware in Fastify is critical. Here's the correct order:

```typescript
import fastify from "fastify";
import { createLogger, createErrorPipe } from "log-bundle";

const app = fastify({
  logger: createLogger(),
});

// 1. Register plugins (CORS, compression, etc.)
await app.register(import("@fastify/cors"));
await app.register(import("@fastify/compress"));

// 2. Register authentication/authorization plugins
await app.register(import("@fastify/jwt"), { secret: "supersecret" });

// 3. Register hooks (request logging, authentication checks)
app.addHook("onRequest", async (request, reply) => {
  // Custom request processing
});

// 4. Register routes
await app.register(import("./routes/users"));
await app.register(import("./routes/posts"));

// 5. Register error handler (MUST BE LAST!)
app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
    includeErrorDetails: process.env.NODE_ENV !== "production",
  })
);
```

## Why Order Matters

Fastify processes middleware in the order they are registered:

1. **Plugins first** - CORS, compression, rate limiting need to intercept requests early
2. **Authentication** - Verify user identity before processing routes
3. **Hooks** - Request preprocessing and validation
4. **Routes** - Your application logic
5. **Error handler last** - Catches any errors from above layers

## Error Handler Options

The `createErrorPipe` function accepts several options:

### Basic Configuration

```typescript
app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
    includeErrorDetails: false,
  })
);
```

### Advanced Configuration

```typescript
app.setErrorHandler(
  createErrorPipe(logger, {
    // Show detailed errors in development
    environment: process.env.NODE_ENV,
    includeErrorDetails: process.env.NODE_ENV === "development",

    // Redact sensitive headers from logs and Sentry
    redactHeaders: ["authorization", "cookie", "x-api-key"],

    // Whether to capture request body in Sentry (may contain sensitive data)
    captureRequestBody: false,
  })
);
```

## Using Error Handler in Routes

There are two ways to handle errors in routes:

### Method 1: Using ErrorData (Recommended)

Create lightweight error data objects that get handled by the error pipe:

```typescript
import { notFound, validation, internal } from "log-bundle";

app.get("/users/:id", async (request, reply) => {
  const userId = request.params.id;

  const user = await db.users.findById(userId);

  if (!user) {
    const error = notFound("user", userId);
    return reply.code(404).send(error);
  }

  return user;
});

app.post("/users", async (request, reply) => {
  if (!request.body.email) {
    const error = validation("Email is required", "email");
    return reply.code(400).send(error);
  }

  try {
    const user = await db.users.create(request.body);
    return reply.code(201).send(user);
  } catch (err) {
    const error = internal("Failed to create user");
    return reply.code(500).send(error);
  }
});
```

### Method 2: Throwing HttpError

Throw errors that get caught by the error pipe:

```typescript
import { HttpError, ErrorType, throwInternal } from "log-bundle";

app.get("/users/:id", async (request, reply) => {
  const user = await db.users.findById(request.params.id);

  if (!user) {
    throw new HttpError(
      "User not found",
      404,
      ErrorType.NOT_FOUND,
      { userId: request.params.id }
    );
  }

  return user;
});

app.post("/users", async (request, reply) => {
  try {
    const user = await db.users.create(request.body);
    return reply.code(201).send(user);
  } catch (err) {
    throwInternal("Failed to create user", err as Error);
  }
});
```

## Error Factory for Request Context

Use `ErrorFactory` to automatically include request metadata in all errors:

```typescript
import { ErrorFactory } from "log-bundle";

app.get("/users/:id", async (request, reply) => {
  // Create factory with request context
  const errors = ErrorFactory.forRequest(request);

  const user = await db.users.findById(request.params.id);

  if (!user) {
    // Error automatically includes requestId, url, method, ip
    const error = errors.notFound("user", request.params.id);
    return reply.code(404).send(error);
  }

  return user;
});
```

## Legacy Error Handler

If you need basic error handling without the full error system, use `createFastifyErrorHandler`:

```typescript
import { createFastifyErrorHandler } from "log-bundle";

app.setErrorHandler(
  createFastifyErrorHandler(logger, {
    includeErrorDetails: process.env.NODE_ENV !== "production",
    environment: process.env.NODE_ENV,
  })
);
```

This handler:
- Logs errors with Pino
- Sends server errors to Sentry
- Returns generic error messages
- Does not support ErrorData objects

## Request Logging

Fastify provides built-in request logging when you pass a logger:

```typescript
const app = fastify({
  logger: createLogger({
    level: "info",
  }),

  // Disable if you want custom request logging
  disableRequestLogging: false,
});
```

## Custom Request Hooks

Add custom hooks for request tracking:

```typescript
app.addHook("onRequest", async (request, reply) => {
  request.log.info(
    {
      url: request.url,
      method: request.method,
      ip: request.ip,
    },
    "Request received"
  );
});

app.addHook("onResponse", async (request, reply) => {
  request.log.info(
    {
      url: request.url,
      method: request.method,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    },
    "Request completed"
  );
});
```

## Testing Error Handlers

Test your error handlers with a simple route:

```typescript
app.get("/test-error", async (request, reply) => {
  throw new Error("Test error");
});

app.get("/test-404", async (request, reply) => {
  const error = notFound("test-resource", "123");
  return reply.code(404).send(error);
});
```

## Common Pitfalls

### Pitfall 1: Error Handler Registered Too Early

```typescript
// BAD - Error handler won't catch errors in routes
app.setErrorHandler(createErrorPipe(logger));

app.get("/users", async () => {
  throw new Error("This won't be caught!");
});
```

```typescript
// GOOD - Error handler registered after routes
app.get("/users", async () => {
  throw new Error("This will be caught!");
});

app.setErrorHandler(createErrorPipe(logger));
```

### Pitfall 2: Not Awaiting Plugin Registration

```typescript
// BAD - Plugins registered without await
app.register(import("@fastify/cors"));
app.register(import("@fastify/jwt"), { secret: "key" });

// Error handler might be registered before plugins load
app.setErrorHandler(createErrorPipe(logger));
```

```typescript
// GOOD - Await plugin registration
await app.register(import("@fastify/cors"));
await app.register(import("@fastify/jwt"), { secret: "key" });

app.setErrorHandler(createErrorPipe(logger));
```

### Pitfall 3: Catching Errors Without Rethrowing

```typescript
// BAD - Error swallowed, won't reach error handler
app.get("/users", async () => {
  try {
    await riskyOperation();
  } catch (err) {
    logger.error(err);
    return { error: "Something went wrong" };
  }
});
```

```typescript
// GOOD - Let error handler deal with it
app.get("/users", async () => {
  await riskyOperation(); // Error will be caught by error handler
});
```

## Next Steps

- [Error Handling](./error-handling.md) - Learn about error types and helpers
- [Sentry Integration](./sentry-integration.md) - Configure error tracking
- [Configuration](./configuration.md) - Advanced configuration
