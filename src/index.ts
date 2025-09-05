export { logConfig } from "./config.js";
export { createSentryHook, isSentryInitialized } from "./plugins/sentry/sentry.js";
export type { SentryHookOptions } from "./plugins/sentry/sentry.js";

import { createLogger } from "./logger.js";
export default createLogger;
