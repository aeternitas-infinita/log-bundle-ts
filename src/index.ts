// Core exports
export { logConfig } from "./core/config.js";
export { createLogger } from "./core/logger.js";
export type { LoggerConfig } from "./core/logger.js";
export { createLoggerWithSentry } from "./core/logger-with-sentry.js";
export type { LoggerWithSentry } from "./core/logger-with-sentry.js";

// Sentry utilities (Note: Initialize Sentry manually before importing this library)
export { isSentryInitialized, sendToSentry } from "./integrations/sentry/plugin.js";
export type { SentrySendOptions } from "./integrations/sentry/plugin.js";

// Fastify integration
export { createFastifyErrorHandler } from "./integrations/fastify/error-handler.js";
export type { FastifyErrorHandlerOptions } from "./integrations/fastify/error-handler.js";
export { createErrorPipe } from "./integrations/fastify/error-pipe.js";
export type { ErrorPipeOptions } from "./integrations/fastify/error-pipe.js";

// Process error handling
export { setupProcessErrorHandlers } from "./integrations/process-error-handler.js";
export type { ProcessErrorHandlerOptions } from "./integrations/process-error-handler.js";

// Error handling system (lightweight, non-throwable error data objects)
export type { ErrorData, HttpError } from "./error/index.js";
export {
    badInput,
    busy,
    conflict,
    createErrorData,
    database,
    DEFAULT_HTTP_STATUS_MAP,
    errorConfig,
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

// Default export
import { createLogger } from "./core/logger.js";
export default createLogger;
