# Zod Validation Integration

Automatic validation error handling with Fastify and Zod, returning RFC 9457 compliant error responses.

## Quick Start

```typescript
import Fastify from "fastify";
import { z } from "zod";
import { createErrorPipe, createLogger, createZodValidatorCompiler } from "log-bundle";

const logger = createLogger({ level: "info" });
const fastify = Fastify();

// 1. Set up Zod validator compiler
fastify.setValidatorCompiler(createZodValidatorCompiler());

// 2. Set up error handler (automatically formats Zod errors)
fastify.setErrorHandler(createErrorPipe(logger));

// 3. Use Zod schemas in your routes
fastify.post("/users", {
  schema: {
    body: z.object({
      email: z.string().email(),
      age: z.number().min(18),
    }),
  },
  handler: async (request, reply) => {
    // request.body is typed and validated
    return { success: true };
  },
});
```

## Features

- **Automatic Error Detection** - The error-pipe automatically detects and formats Zod validation errors
- **RFC 9457 Compliant** - Returns standard Problem Details responses
- **Field-Level Errors** - Shows exactly which fields failed validation with detailed metadata
- **Type Safety** - Full TypeScript support with inferred types
- **Status Code 422** - Proper HTTP status for validation errors (Unprocessable Entity)
- **No Sentry Noise** - Validation errors are not sent to Sentry (they're user errors, not system errors)
- **Enhanced Metadata** - Includes all Zod error information (expected types, constraints, etc.)

## Error Response Format

When validation fails, the error response includes comprehensive field-level details:

```json
{
  "type": "urn:problem:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email",
      "meta": {
        "code": "invalid_string",
        "validation": "email"
      }
    },
    {
      "field": "age",
      "message": "Number must be greater than or equal to 18",
      "meta": {
        "code": "too_small",
        "minimum": 18,
        "type": "number",
        "inclusive": true
      }
    }
  ]
}
```

## ValidationError Format

Each validation error includes:

```typescript
type ValidationError = {
  field: string;              // Field path (e.g., "email", "user.address.zipCode")
  message: string;            // Human-readable error message
  meta?: {                    // Zod-specific metadata
    code: string;             // Zod error code (e.g., "invalid_type", "too_small")
    expected?: unknown;       // Expected type/value
    received?: unknown;       // Received type/value
    minimum?: number;         // Min constraint
    maximum?: number;         // Max constraint
    inclusive?: boolean;      // Whether min/max is inclusive
    validation?: string;      // Validation type (email, url, uuid, etc.)
    keys?: string[];          // Unrecognized keys
    // ... and more Zod-specific fields
  };
}
```

## Examples

### Basic Validation

```typescript
fastify.post("/users", {
  schema: {
    body: z.object({
      email: z.string().email("Invalid email format"),
      name: z.string().min(2, "Name must be at least 2 characters"),
      age: z.number().min(18, "Must be at least 18 years old"),
    }),
  },
  handler: async (request, reply) => {
    return { success: true };
  },
});
```

**Invalid request:**
```json
{
  "email": "not-an-email",
  "name": "A",
  "age": 15
}
```

**Error response (422):**
```json
{
  "type": "urn:problem:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "meta": {
        "code": "invalid_string",
        "validation": "email"
      }
    },
    {
      "field": "name",
      "message": "Name must be at least 2 characters",
      "meta": {
        "code": "too_small",
        "minimum": 2,
        "type": "string",
        "inclusive": true
      }
    },
    {
      "field": "age",
      "message": "Must be at least 18 years old",
      "meta": {
        "code": "too_small",
        "minimum": 18,
        "type": "number",
        "inclusive": true
      }
    }
  ]
}
```

### Nested Object Validation

```typescript
fastify.post("/orders", {
  schema: {
    body: z.object({
      items: z.array(
        z.object({
          productId: z.string(),
          quantity: z.number().positive(),
        })
      ).min(1, "At least one item is required"),
      shipping: z.object({
        address: z.string().min(5),
        zipCode: z.string().regex(/^\d{5}$/, "Invalid ZIP code"),
      }),
    }),
  },
  handler: async (request, reply) => {
    return { orderId: "123" };
  },
});
```

**Invalid request:**
```json
{
  "items": [],
  "shipping": {
    "address": "123",
    "zipCode": "abc"
  }
}
```

**Error response:**
```json
{
  "type": "urn:problem:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "items",
      "message": "At least one item is required",
      "meta": {
        "code": "too_small",
        "minimum": 1,
        "type": "array",
        "inclusive": true
      }
    },
    {
      "field": "shipping.address",
      "message": "String must contain at least 5 character(s)",
      "meta": {
        "code": "too_small",
        "minimum": 5,
        "type": "string",
        "inclusive": true
      }
    },
    {
      "field": "shipping.zipCode",
      "message": "Invalid ZIP code",
      "meta": {
        "code": "invalid_string",
        "validation": "regex"
      }
    }
  ]
}
```

### Query Parameters and Path Params

```typescript
fastify.get<{ Params: { id: string }; Querystring: { page: number } }>("/users/:id", {
  schema: {
    params: z.object({
      id: z.string().uuid("Invalid user ID"),
    }),
    querystring: z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  },
  handler: async (request, reply) => {
    const { id } = request.params;
    const { page, limit } = request.query;
    return { id, page, limit };
  },
});
```

### Type Validation Errors

```typescript
// Request with wrong types
{
  "email": 123,        // Should be string
  "age": "25"          // Should be number
}

// Error response
{
  "type": "urn:problem:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Expected string, received number",
      "meta": {
        "code": "invalid_type",
        "expected": "string",
        "received": "number"
      }
    },
    {
      "field": "age",
      "message": "Expected number, received string",
      "meta": {
        "code": "invalid_type",
        "expected": "number",
        "received": "string"
      }
    }
  ]
}
```

### Missing Required Fields

```typescript
// Request missing required field
{
  "name": "John"
  // Missing "email"
}

// Error response
{
  "type": "urn:problem:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Required",
      "meta": {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined"
      }
    }
  ]
}
```

### Unrecognized Keys

```typescript
// Request with extra fields (using .strict())
{
  "email": "test@example.com",
  "unknownField": "value"
}

// Error response
{
  "type": "urn:problem:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "root",
      "message": "Unrecognized key(s) in object: 'unknownField'",
      "meta": {
        "code": "unrecognized_keys",
        "keys": ["unknownField"]
      }
    }
  ]
}
```

## How It Works

### Architecture

The Zod validation integration consists of two coordinated components:

#### 1. Validator Compiler (`createZodValidatorCompiler`)

Integrates Zod with Fastify's validation system:

```typescript
export function createZodValidatorCompiler(): FastifySchemaCompiler<ZodType> {
  return ({ schema }) => {
    return (data) => {
      const result = schema.safeParse(data);

      if (result.success) {
        return { value: result.data };
      }

      return { error: result.error };
    };
  };
}
```

The validator:
- Uses Zod's `safeParse()` for validation
- Returns validated data on success
- Returns the ZodError on failure

#### 2. Error Detection and Formatting (`createErrorPipe`)

Automatically detects and formats Zod validation errors:

```typescript
function isZodValidationError(error: unknown): error is FastifyError & ZodError {
  return error instanceof ZodError;
}

function parseZodErrors(zodError: ZodError): ValidationError[] {
  return zodError.issues.map((issue) => {
    const meta: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(issue)) {
      if (key !== "path" && key !== "message") {
        meta[key] = val;
      }
    }

    return {
      field: issue.path.length > 0 ? issue.path.join(".") : "root",
      message: issue.message,
      meta,
    };
  });
}
```

The error handler:
- Detects Zod validation errors using `instanceof ZodError`
- Extracts all Zod issue metadata into the `meta` field
- Builds RFC 9457 compliant response with field-level errors
- Sets HTTP status to 422 (Unprocessable Entity)
- Skips sending to Sentry (validation errors are user errors)

### Flow Diagram

```
User Request with Invalid Data
    ↓
Fastify Route Handler
    ↓
Validator Compiler (createZodValidatorCompiler)
    ↓
Zod Schema Validation (schema.safeParse)
    ↓
Validation Fails → ZodError Created
    ↓
Return { error: zodError }
    ↓
Fastify Error Handler (createErrorPipe)
    ↓
isZodValidationError Check (instanceof ZodError)
    ↓
Extract validation errors from ZodError.issues
    ↓
Convert to ValidationError[] with full metadata
    ↓
Build RFC 9457 Response
    ↓
Return 422 with detailed field errors
```

## Client-Side Error Handling

Frontend applications can parse the detailed error responses:

```typescript
// React form error handling example
const handleSubmitError = (error: ErrorResponse) => {
  if (error.status === 422 && error.errors) {
    error.errors.forEach((validationError) => {
      const { field, message, meta } = validationError;

      // Show field-specific error
      setFieldError(field, message);

      // Use metadata for smart handling
      if (meta?.code === "too_small" && meta.minimum) {
        console.log(`${field} must be at least ${meta.minimum}`);
      }

      if (meta?.code === "invalid_type") {
        console.log(`${field} expected ${meta.expected}, got ${meta.received}`);
      }

      if (meta?.validation === "email") {
        // Show email-specific error UI
      }
    });
  }
};
```

## Benefits

### Complete Information
All Zod error details are preserved in the `meta` field, giving clients full context about validation failures.

### RFC 9457 Compliant
The response follows the Problem Details standard while using the optional `meta` extension field for additional data.

### Machine-Readable
Clients can programmatically parse error codes and metadata for smart error handling and user feedback.

### Developer-Friendly
Frontend developers get detailed information to show precise validation messages and constraints.

### No Sentry Noise
Validation errors don't clutter Sentry since they're expected user input errors, not system failures.

## Common Zod Error Codes

| Code | Description | Example Meta Fields |
|------|-------------|---------------------|
| `invalid_type` | Wrong data type | `expected`, `received` |
| `invalid_string` | String format validation failed | `validation` (email, url, uuid, regex, etc.) |
| `too_small` | Value below minimum | `minimum`, `type`, `inclusive` |
| `too_big` | Value above maximum | `maximum`, `type`, `inclusive` |
| `invalid_literal` | Doesn't match literal value | `expected`, `received` |
| `unrecognized_keys` | Extra fields in strict mode | `keys` (array of field names) |
| `invalid_union` | None of union types matched | `unionErrors` |
| `invalid_enum_value` | Not in enum values | `options`, `received` |
| `invalid_date` | Invalid date value | - |
| `custom` | Custom validation failed | `params` |

## Testing

Run the example to see validation in action:

```bash
# From the examples directory
npx tsx examples/fastify-zod-validation.ts
```

Test with curl:

```bash
# Valid request
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"John","age":25}'

# Invalid request (will return 422 with detailed errors)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","name":"A","age":15}'
```

## See Also

- [Error Handling Guide](./error-handling.md) - Complete error handling guide
- [Fastify Integration](./fastify-integration.md) - Fastify middleware setup
- [Example Code](../examples/fastify-zod-validation.ts) - Complete working example
- [Zod Documentation](https://zod.dev) - Zod schema validation library
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) - Problem Details specification
