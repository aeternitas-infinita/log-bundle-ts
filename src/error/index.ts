// Error data (lightweight, non-throwable error objects)
export type { ErrorData } from "./error-data.js";
export {
    createErrorData,
    getHttpStatus,
    shouldSendToSentry,
    toErrorResponse,
    toHttpResponse,
    toLogObject,
} from "./error-data.js";

// Error utilities (low-level API for custom error handling)
export {
    extractErrorData,
    getEssentialErrorData,
    getErrorContext,
    getValidationErrors,
    isClientError,
    isErrorData,
    isErrorType,
    isServerError,
    withContext,
    withHttpStatus,
    withoutSentry,
} from "./error-utils.js";

// Error types and interfaces
export { DEFAULT_HTTP_STATUS_MAP, ErrorType } from "./error-types.js";
export type { ErrorResponse, SuccessResponse, ValidationError } from "./error-types.js";

// Factory functions (create lightweight error data objects)
export { badInput, busy, conflict, database, external, forbidden, internal, notFound, timeout, unauthorized, validation } from "./factories.js";

// ErrorFactory class (create errors with bound context)
export { ErrorFactory } from "./error-factory.js";

// Throwable error helpers (for route handlers with centralized error pipe)
// Only throwInternal is exported - users should use new HttpError() for custom types
export { HttpError, isHttpError, throwInternal } from "./error-helpers.js";

// Global error configuration
export { errorConfig } from "./error-config.js";
export type { StatusCodeRule } from "./error-config.js";
