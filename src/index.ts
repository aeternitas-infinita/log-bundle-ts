// Core exports
export { logConfig } from "./core/config.js";
export type { LogBundleConfig } from "./core/config.js";
export { createLogger } from "./core/logger.js";
export type { LoggerConfig, LoggerWithSentry } from "./core/logger.js";

// Sentry utilities
export { isSentryInitialized, sendToSentry } from "./integrations/sentry/plugin.js";
export type { SentrySendOptions } from "./integrations/sentry/plugin.js";

// Fastify integration
export { createFastifyErrorHandler } from "./integrations/fastify/error-handler.js";
export type { FastifyErrorHandlerOptions } from "./integrations/fastify/error-handler.js";
export { createErrorPipe } from "./integrations/fastify/error-pipe.js";
export type { ErrorPipeOptions } from "./integrations/fastify/error-pipe.js";

// Fastify integration (raw/low-level for legacy projects)
export { createRawFastifyErrorHandler } from "./integrations/fastify/raw-error-handler.js";
export type { RawErrorHandlerOptions } from "./integrations/fastify/raw-error-handler.js";

// Process error handling
export { setupProcessErrorHandlers } from "./integrations/process-error-handler.js";
export type { ProcessErrorHandlerOptions } from "./integrations/process-error-handler.js";

// Error handling system (lightweight, non-throwable error data objects)
export type { ErrorData, HttpError, StatusCodeRule } from "./error/index.js";
export {
    badInput,
    busy,
    conflict,
    createErrorData,
    database,
    DEFAULT_HTTP_STATUS_MAP,
    errorConfig,
    ErrorFactory,
    ErrorType,
    external,
    forbidden,
    getHttpStatus,
    internal,
    isHttpError,
    notFound,
    shouldSendToSentry,
    throwInternal,
    timeout,
    toErrorResponse,
    toHttpResponse,
    toLogObject,
    unauthorized,
    validation,
} from "./error/index.js";
export type { ErrorResponse, SuccessResponse, ValidationError } from "./error/index.js";

// Error utilities (low-level API for custom error handling in legacy projects)
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
} from "./error/index.js";

// API Response factory (standardized success/error response builder)
export { ApiResponse } from "./error/index.js";

// Default export
import { createLogger } from "./core/logger.js";
export default createLogger;
