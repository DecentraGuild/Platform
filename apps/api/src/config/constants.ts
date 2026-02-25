/**
 * Default configuration values. Override via environment variables when needed.
 * Env is used only for secrets and environment-specific overrides.
 */

/** Default HTTP port when PORT is not set. */
export const DEFAULT_PORT = 3001

/** Default explicit CORS origins (dev localhost). Override with CORS_ORIGIN in production. */
export const DEFAULT_CORS_ORIGIN =
  'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002'

/** DB pool max connections. Override with DB_POOL_MAX. */
export const DEFAULT_DB_POOL_MAX = 10

/** DB pool idle timeout in ms. Override with DB_IDLE_TIMEOUT_MS. */
export const DEFAULT_DB_IDLE_TIMEOUT_MS = 30000

/** Global rate limit: max requests per window. Override with RATE_LIMIT_MAX. */
export const DEFAULT_RATE_LIMIT_MAX = 200

/** Global rate limit: time window. Override with RATE_LIMIT_WINDOW. */
export const DEFAULT_RATE_LIMIT_WINDOW = '1 minute'

/** Auth endpoints: max requests per minute per IP. Override with RATE_LIMIT_AUTH_MAX. */
export const DEFAULT_RATE_LIMIT_AUTH_MAX = 10

/** Tenant create: max requests per minute per IP. Override with RATE_LIMIT_TENANT_CREATE_MAX. */
export const DEFAULT_RATE_LIMIT_TENANT_CREATE_MAX = 5

/** Discord verify: max requests per minute per IP. Override with RATE_LIMIT_DISCORD_VERIFY_MAX. */
export const DEFAULT_RATE_LIMIT_DISCORD_VERIFY_MAX = 20

/** Admin write: max requests per minute per IP. Override with RATE_LIMIT_ADMIN_WRITE_MAX. */
export const DEFAULT_RATE_LIMIT_ADMIN_WRITE_MAX = 60

/** Stricter rate limit window in ms (1 minute). */
export const RATE_LIMIT_STRICT_WINDOW_MS = 60 * 1000

/** Worker: Discord sync interval in minutes. 0 = disabled. Override with DISCORD_SYNC_INTERVAL_MINUTES. */
export const DEFAULT_DISCORD_SYNC_INTERVAL_MINUTES = 0

/** Worker: module lifecycle job interval in minutes. 0 = disabled. Override with MODULE_LIFECYCLE_INTERVAL_MINUTES. */
export const DEFAULT_MODULE_LIFECYCLE_INTERVAL_MINUTES = 0

/** Module lifecycle: minutes from deactivate date until deactivating -> off. Override with MODULE_LIFECYCLE_DEACTIVATING_MINUTES. */
export const DEFAULT_MODULE_LIFECYCLE_DEACTIVATING_MINUTES = 2
