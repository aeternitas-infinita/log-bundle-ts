# Getting Started

This guide will walk you through setting up log-bundle in your Node.js application with Fastify.

## Installation

```bash
npm install log-bundle
```

## Peer Dependencies

log-bundle requires the following peer dependencies:

- `@sentry/node` (optional) - For error tracking and monitoring
- `fastify` (optional) - For Fastify integration

Install them if you plan to use these features:

```bash
npm install @sentry/node fastify
```

## Basic Setup

### Step 1: Initialize Sentry (Optional)

If you want to use Sentry for error tracking, initialize it at the very top of your application entry point. This must be done before importing any other modules to ensure proper instrumentation.

```typescript
// src/index.ts or src/server.ts
import { initSentryForFastify } from "log-bundle";

// Initialize Sentry first
initSentryForFastify({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  enableProfiling: true,
  tracesSampleRate: 0.1,
});

// Now import other modules
import fastify from "fastify";
// ... rest of imports
```

### Step 2: Create Logger

Create a logger instance using the `createLogger` function:

```typescript
import { createLogger } from "log-bundle";

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
});

logger.info("Application starting");
```

### Step 3: Setup Process Error Handlers

Catch unhandled errors and rejections to prevent crashes:

```typescript
import { setupProcessErrorHandlers } from "log-bundle";

setupProcessErrorHandlers(logger, {
  exitOnUncaughtException: process.env.NODE_ENV === "production",
  exitOnUnhandledRejection: false,
});
```

### Step 4: Setup Fastify Error Handler

Create an error handler for your Fastify application:

```typescript
import { createErrorPipe } from "log-bundle";

const app = fastify({
  logger: logger,
});

// Setup error handler (must be done AFTER all routes and plugins)
app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
    includeErrorDetails: process.env.NODE_ENV !== "production",
  })
);
```

## Complete Example

Here's a complete example of setting up log-bundle with Fastify:

```typescript
// src/index.ts
import { initSentryForFastify, createLogger, setupProcessErrorHandlers, createErrorPipe } from "log-bundle";
import fastify from "fastify";

// 1. Initialize Sentry (must be first!)
if (process.env.SENTRY_DSN) {
  initSentryForFastify({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    enableProfiling: true,
    tracesSampleRate: 0.1,
  });
}

// 2. Create logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
});

// 3. Setup process error handlers
setupProcessErrorHandlers(logger, {
  exitOnUncaughtException: process.env.NODE_ENV === "production",
});

// 4. Create Fastify app
const app = fastify({
  logger: logger,
});

// 5. Register routes
app.get("/", async (request, reply) => {
  return { message: "Hello World" };
});

// 6. Setup error handler (AFTER routes)
app.setErrorHandler(
  createErrorPipe(logger, {
    environment: process.env.NODE_ENV,
    includeErrorDetails: process.env.NODE_ENV !== "production",
  })
);

// 7. Start server
const start = async () => {
  try {
    await app.listen({ port: 3000 });
    logger.info("Server listening on http://localhost:3000");
  } catch (err) {
    logger.fatal(err, "Failed to start server");
    process.exit(1);
  }
};

start();
```

## Next Steps

- [Error Handling](./error-handling.md) - Learn about the error handling system
- [Fastify Integration](./fastify-integration.md) - Deep dive into Fastify middleware setup
- [Sentry Integration](./sentry-integration.md) - Configure Sentry for production
- [Configuration](./configuration.md) - Advanced configuration options
