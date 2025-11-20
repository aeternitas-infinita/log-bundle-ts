/**
 * Example: Using Zod Validation with Fastify and log-bundle
 *
 * This example demonstrates how to set up automatic validation error handling
 * that returns RFC 9457 compliant error responses with detailed field-level errors.
 */

import Fastify from "fastify";
import { z } from "zod";
import { createErrorPipe, createLogger, createZodValidatorCompiler } from "../src/index.js";

// Create logger
const logger = createLogger({
    level: "info",
    pretty: true,
});

// Create Fastify instance
const fastify = Fastify({
    logger: false, // We use our own logger
});

// Set up Zod validator compiler
fastify.setValidatorCompiler(createZodValidatorCompiler());

// Set up error handler with automatic Zod error formatting
fastify.setErrorHandler(
    createErrorPipe(logger, {
        includeErrorDetails: true,
        environment: "dev",
    })
);

// Define validation schemas
const createUserSchema = z.object({
    email: z.string().email("Invalid email format"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    age: z.number().min(18, "Must be at least 18 years old").max(120, "Age must be realistic"),
    role: z.enum(["admin", "user", "guest"]).optional(),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(2).optional(),
    age: z.number().min(18).max(120).optional(),
});

// Routes with validation
fastify.post("/users", {
    schema: {
        body: createUserSchema,
    },
    handler: async (request, reply) => {
        // request.body is now typed and validated
        const user = request.body;

        logger.info({ user }, "Creating new user");

        return {
            data: {
                id: "123",
                ...user,
            },
        };
    },
});

fastify.patch<{ Params: { id: string } }>("/users/:id", {
    schema: {
        params: z.object({
            id: z.string().uuid("Invalid user ID format"),
        }),
        body: updateUserSchema,
    },
    handler: async (request, reply) => {
        const { id } = request.params;
        const updates = request.body;

        logger.info({ userId: id, updates }, "Updating user");

        return {
            data: {
                id,
                ...updates,
            },
        };
    },
});

// Nested object validation
fastify.post("/orders", {
    schema: {
        body: z.object({
            items: z
                .array(
                    z.object({
                        productId: z.string(),
                        quantity: z.number().positive(),
                        price: z.number().positive(),
                    })
                )
                .min(1, "At least one item is required"),
            shipping: z.object({
                address: z.string().min(5),
                city: z.string().min(2),
                zipCode: z.string().regex(/^\d{5}$/, "Invalid ZIP code format"),
            }),
        }),
    },
    handler: async (request, reply) => {
        return {
            data: {
                orderId: "order-123",
                status: "created",
            },
        };
    },
});

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: 3000 });
        logger.info("Server listening on http://localhost:3000");

        console.log("\n=== Try these example requests ===\n");

        console.log("1. Valid request:");
        console.log(`
curl -X POST http://localhost:3000/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","name":"John","age":25}'
        `);

        console.log("\n2. Invalid email (will return 422 with detailed errors):");
        console.log(`
curl -X POST http://localhost:3000/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"invalid","name":"A","age":15}'
        `);

        console.log("\n3. Missing required fields:");
        console.log(`
curl -X POST http://localhost:3000/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com"}'
        `);

        console.log("\n4. Invalid nested object:");
        console.log(`
curl -X POST http://localhost:3000/orders \\
  -H "Content-Type: application/json" \\
  -d '{"items":[],"shipping":{"address":"123","city":"A","zipCode":"123"}}'
        `);

        console.log("\n=== Expected Error Response Format ===\n");
        console.log(`{
  "type": "urn:problem:validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "name",
      "message": "Name must be at least 2 characters"
    },
    {
      "field": "age",
      "message": "Must be at least 18 years old"
    }
  ]
}\n`);
    } catch (err) {
        logger.error(err, "Error starting server");
        process.exit(1);
    }
};

start();
