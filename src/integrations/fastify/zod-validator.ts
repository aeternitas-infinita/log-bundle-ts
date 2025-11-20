import { type FastifySchemaCompiler } from "fastify";
import type { ZodType } from "zod";

/**
 * Creates a Fastify schema compiler for Zod validation
 *
 * This validator integrates with the error-pipe to automatically format
 * Zod validation errors into RFC 9457 compliant error responses with detailed
 * field-level validation errors.
 *
 * The validator sets the FST_ERR_VALIDATION error code on ZodErrors, which
 * allows the error-pipe to detect and properly format them.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { createZodValidatorCompiler } from "log-bundle/integrations/fastify/zod-validator";
 *
 * const fastify = Fastify();
 *
 * // Register the Zod validator compiler
 * fastify.setValidatorCompiler(createZodValidatorCompiler());
 *
 * // Use in routes
 * fastify.post("/users", {
 *   schema: {
 *     body: z.object({
 *       email: z.string().email(),
 *       age: z.number().min(18),
 *     }),
 *   },
 *   handler: async (request, reply) => {
 *     // request.body is now typed and validated
 *     return { success: true };
 *   }
 * });
 * ```
 *
 * Error Response Example:
 * ```json
 * {
 *   "type": "urn:problem:validation",
 *   "title": "Validation Error",
 *   "status": 422,
 *   "detail": "Request validation failed",
 *   "errors": [
 *     {
 *       "field": "email",
 *       "message": "Invalid email"
 *     },
 *     {
 *       "field": "age",
 *       "message": "Number must be greater than or equal to 18"
 *     }
 *   ]
 * }
 * ```
 */
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
