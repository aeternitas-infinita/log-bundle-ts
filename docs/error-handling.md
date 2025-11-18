# Error Handling

log-bundle provides a comprehensive error handling system with predefined error types, HTTP status mappings, and RFC 7807 compliant responses.

## Public vs Internal Data

The error system clearly separates:
- **Public data** - Safe to send to end users (title, detail, meta, validationErrors)
- **Internal data** - Only for logs/Sentry (cause, context, tags)

This prevents accidental exposure of sensitive information like stack traces, database queries, or internal system details to end users.

## Error Types

The library provides the following error types:

| Error Type | HTTP Status | Use Case |
|------------|-------------|----------|
| NOT_FOUND | 404 | Resource not found |
| VALIDATION | 400 | Input validation failure |
| BAD_INPUT | 400 | Malformed request data |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Permission denied |
| CONFLICT | 409 | Resource conflict (duplicate) |
| INTERNAL | 500 | Internal server error |
| DATABASE | 500 | Database operation failure |
| EXTERNAL | 502 | External service failure |
| TIMEOUT | 504 | Operation timeout |
| BUSY | 503 | Service temporarily unavailable |

## Factory Functions

Use factory functions to create error data objects:

### notFound

```typescript
import { notFound } from "log-bundle";

// Simple usage
const error = notFound("user", userId);
// Returns: ErrorData with 404 status

// With internal context (for logs/Sentry only)
const error = notFound("user", userId, {
  internal: {
    context: {
      requestId: "abc123",
      searchQuery: { email: "user@example.com" },
    }
  }
});

// With public metadata (sent to users)
const error = notFound("user", userId, {
  public: {
    meta: { suggestion: "Check the user ID format" }
  }
});
```

### validation

```typescript
import { validation } from "log-bundle";

// Simple usage
const error = validation("Email must be valid", "email");
// Returns: ErrorData with 400 status and validation errors array

// With internal context
const error = validation("Age must be >= 18", "age", {
  internal: {
    context: {
      providedValue: 15,
      requestId: "abc123",
    }
  }
});

// With custom public detail
const error = validation("Invalid input", "email", {
  public: {
    detail: "Please provide a valid email address",
  }
});
```

### unauthorized

```typescript
import { unauthorized } from "log-bundle";

const error = unauthorized();
// Returns: ErrorData with 401 status

const error = unauthorized("Token expired", {
  tokenExpiry: "2024-01-01",
});
```

### forbidden

```typescript
import { forbidden } from "log-bundle";

const error = forbidden("post", "insufficient permissions");
// Returns: ErrorData with 403 status

const error = forbidden("admin-panel", "not admin", {
  userId: "123",
  requiredRole: "admin",
});
```

### internal

```typescript
import { internal } from "log-bundle";

// Simple usage
const error = internal("Unexpected error occurred");
// Returns: ErrorData with 500 status

// Capture original error
try {
  await processPayment(paymentId);
} catch (err) {
  const error = internal("Failed to process payment", {
    internal: {
      cause: err, // Original error for Sentry
      context: {
        paymentId: "pay_123",
        provider: "stripe",
      },
      tags: {
        service: "payment",
        severity: "critical",
      }
    }
  });
}
```

### database

```typescript
import { database } from "log-bundle";

// Simple usage
const error = database("Query timeout");
// Returns: ErrorData with 500 status

// Capture original error for Sentry
try {
  await db.query("SELECT * FROM users");
} catch (err) {
  const error = database("Query failed", {
    public: {
      detail: "Unable to fetch user data"
    },
    internal: {
      cause: err, // Original error goes to Sentry only
      context: {
        query: "SELECT * FROM users",
        poolSize: 10,
        activeConnections: 10,
      }
    }
  });
}
```

### conflict

```typescript
import { conflict } from "log-bundle";

const error = conflict("user", "email already exists");
// Returns: ErrorData with 409 status

const error = conflict("order", "duplicate order", {
  orderId: "ord_123",
  existingOrderId: "ord_456",
});
```

### external

```typescript
import { external } from "log-bundle";

const error = external("payment-service", "API timeout");
// Returns: ErrorData with 502 status

const error = external("stripe", "Card declined", {
  statusCode: 402,
  errorCode: "card_declined",
});
```

### timeout

```typescript
import { timeout } from "log-bundle";

const error = timeout("database query", "5s");
// Returns: ErrorData with 504 status

const error = timeout("API call", "10s", {
  endpoint: "/api/users",
  timeoutMs: 10000,
});
```

### busy

```typescript
import { busy } from "log-bundle";

const error = busy("Service under maintenance");
// Returns: ErrorData with 503 status

const error = busy("Too many requests", {
  retryAfter: 60,
});
```

## ErrorData Object

All factory functions return an `ErrorData` object:

```typescript
type ErrorData = {
  readonly type: ErrorType;
  readonly message: string; // Internal only

  readonly public?: {
    title?: string;           // RFC 7807
    detail?: string;          // RFC 7807
    instance?: string;        // RFC 7807
    meta?: Record<string, unknown>; // Public metadata
    validationErrors?: ValidationError[];
  };

  readonly internal?: {
    cause?: Error;            // Original error for Sentry
    context?: Record<string, unknown>; // Debug context
    tags?: Record<string, string>; // Sentry tags
  };

  readonly httpStatus?: number;
  readonly skipSentry?: boolean;
};
```

### Public Data
Data in `public` is safe to send to end users via HTTP responses. It follows RFC 7807 standards:
- `title` - Short human-readable summary
- `detail` - Human-readable explanation specific to this error
- `instance` - URI reference to this specific error occurrence
- `meta` - Additional public metadata (e.g., suggestions, links)
- `validationErrors` - Array of field validation errors

### Internal Data
Data in `internal` is only for logs and Sentry, never exposed to users:
- `cause` - Original Error object with full stack trace
- `context` - Debug information (query params, internal state, etc.)
- `tags` - Custom tags for Sentry categorization

## Common Patterns

### Wrapping Database Errors

```typescript
import { database } from "log-bundle";

async function getUser(id: string) {
  try {
    return await db.users.findById(id);
  } catch (err) {
    throw database("Failed to fetch user", {
      public: { detail: "Unable to retrieve user data" },
      internal: {
        cause: err, // Original error for Sentry
        context: { userId: id, operation: "findById" }
      }
    });
  }
}
```

### Wrapping External API Errors

```typescript
import { external } from "log-bundle";

async function fetchFromStripe(customerId: string) {
  try {
    return await stripe.customers.retrieve(customerId);
  } catch (err) {
    throw external("stripe", "Failed to retrieve customer", {
      public: { detail: "Unable to fetch payment information" },
      internal: {
        cause: err,
        context: { customerId, provider: "stripe" },
        tags: { service: "payment", provider: "stripe" }
      }
    });
  }
}
```

### Validation with Context

```typescript
import { validation } from "log-bundle";

function validateAge(age: number, requestId: string) {
  if (age < 18) {
    return validation("Age must be at least 18", "age", {
      public: {
        detail: "You must be 18 years or older to register",
        meta: { minimumAge: 18, providedAge: age }
      },
      internal: {
        context: { requestId, validationRule: "minimum_age" }
      }
    });
  }
}
```

## Utility Functions

### Converting to HTTP Response

```typescript
import { toHttpResponse, notFound } from "log-bundle";

const error = notFound("user", userId);
const { statusCode, body } = toHttpResponse(error);

// statusCode: 404
// body: {
//   type: "/errors/not_found",
//   title: "Resource Not Found",
//   status: 404,
//   detail: "The requested user could not be found"
// }
// Note: Only public data is included, internal context is excluded
```

### Converting to Error Response (RFC 7807)

```typescript
import { toErrorResponse, notFound } from "log-bundle";

const error = notFound("user", userId, {
  public: { meta: { suggestion: "Check user ID" } }
});
const response = toErrorResponse(error, "https://api.example.com");

// response: {
//   type: "https://api.example.com/errors/not_found",
//   title: "Resource Not Found",
//   status: 404,
//   detail: "The requested user could not be found",
//   meta: { suggestion: "Check user ID" }
// }
// Note: Only public data is included (meta from public, not internal.context)
```

### Checking Error Status

```typescript
import { isClientError, isServerError, notFound, internal } from "log-bundle";

const notFoundError = notFound("user", userId);
isClientError(notFoundError); // true
isServerError(notFoundError); // false

const internalError = internal("Database failed");
isClientError(internalError); // false
isServerError(internalError); // true
```

### Adding Context to Errors

```typescript
import { withContext, notFound } from "log-bundle";

let error = notFound("user", userId);

// Add additional internal context (for logs/Sentry)
error = withContext(error, {
  requestId: "abc123",
  userId: "456",
  timestamp: new Date().toISOString(),
});
// This merges into error.internal.context
```

### Overriding HTTP Status

```typescript
import { withHttpStatus, notFound } from "log-bundle";

let error = notFound("user", userId);

// Change status from 404 to 410 (Gone)
error = withHttpStatus(error, 410);
```

### Skipping Sentry

```typescript
import { withoutSentry, notFound } from "log-bundle";

// Using utility
let error = notFound("user", userId);
error = withoutSentry(error);

// Or directly in factory
const error = notFound("user", userId, { skipSentry: true });
```

## Throwable Errors

For use with error handlers that catch thrown errors:

### HttpError Class

```typescript
import { HttpError, ErrorType } from "log-bundle";

throw new HttpError(
  "User not found",
  404,
  ErrorType.NOT_FOUND,
  { userId: "123" }
);
```

### throwInternal Helper

```typescript
import { throwInternal } from "log-bundle";

try {
  await riskyOperation();
} catch (err) {
  throwInternal("Operation failed", err as Error);
}
```

### Type Guard

```typescript
import { isHttpError } from "log-bundle";

try {
  // ...
} catch (err) {
  if (isHttpError(err)) {
    console.log(err.statusCode, err.errorType);
  }
}
```

## ErrorFactory for Request Context

Automatically inject request context into all errors:

```typescript
import { ErrorFactory } from "log-bundle";

app.get("/users/:id", async (request, reply) => {
  const errors = ErrorFactory.forRequest(request);

  const user = await db.users.findById(request.params.id);

  if (!user) {
    // Error includes: requestId, url, method, ip
    return reply.code(404).send(errors.notFound("user", request.params.id));
  }

  return user;
});
```

### Custom Error Factory

Create a factory with custom context:

```typescript
import { ErrorFactory } from "log-bundle";

const errors = new ErrorFactory({
  service: "user-service",
  version: "1.0.0",
  region: "us-east-1",
});

const error = errors.notFound("user", userId);
// Includes service, version, region in context
```

## Advanced Configuration

### Custom HTTP Status Mapping

```typescript
import { errorConfig, ErrorType } from "log-bundle";

// Change default status codes
errorConfig.setCustomStatusMap({
  [ErrorType.NOT_FOUND]: 410, // Gone instead of Not Found
  [ErrorType.BUSY]: 429, // Too Many Requests instead of Service Unavailable
});
```

### Custom Error Types

```typescript
import { errorConfig } from "log-bundle";

// Register custom error type
errorConfig.registerErrorType("rate_limited", 429);
```

### Sentry Status Codes

```typescript
import { errorConfig } from "log-bundle";

// Only send specific status codes to Sentry
errorConfig.setSentryStatusCodes([500, 502, 503, 504]);

// Or include some 4xx errors
errorConfig.setSentryStatusCodes([401, 403, 500, 502, 503, 504]);
```

## Best Practices

### Return Early with Errors

```typescript
app.get("/users/:id", async (request, reply) => {
  const user = await db.users.findById(request.params.id);

  if (!user) {
    return reply.code(404).send(notFound("user", request.params.id));
  }

  // Continue with happy path
  return user;
});
```

### Use Specific Error Types

```typescript
// BAD - Generic error
const error = internal("Something went wrong");

// GOOD - Specific error
const error = database("Connection pool exhausted", {
  poolSize: 10,
  activeConnections: 10,
});
```

### Include Helpful Context

```typescript
// BAD - No context
const error = notFound("user", userId);

// GOOD - Rich context
const error = notFound("user", userId, {
  searchQuery: { email: "user@example.com" },
  attemptedAt: new Date().toISOString(),
  searchedTables: ["users", "archived_users"],
});
```

### Don't Expose Internal Errors

```typescript
try {
  await db.users.create(userData);
} catch (err) {
  // BAD - Exposes internal error
  throw err;

  // GOOD - Generic user-facing message
  throwInternal("Failed to create user");
}
```

## Next Steps

- [Fastify Integration](./fastify-integration.md) - Use errors with Fastify
- [Sentry Integration](./sentry-integration.md) - Track errors in production
- [Configuration](./configuration.md) - Advanced configuration
