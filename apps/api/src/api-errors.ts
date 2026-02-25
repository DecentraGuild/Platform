/**
 * Standard API error response shape: { error, code? }.
 * Clients can branch on `code` for i18n or conditional UI (e.g. show re-link Discord).
 */

export interface ApiErrorBody {
  error: string
  code?: string
  [key: string]: unknown
}

/** Build error body with optional stable code. Spread extra fields when needed: { ...apiError(msg, code), slug }. */
export function apiError(message: string, code: string, extra?: Record<string, unknown>): ApiErrorBody {
  const body: ApiErrorBody = { error: message, code }
  if (extra && typeof extra === 'object') {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) body[k] = v
    }
  }
  return body
}

/** Stable error codes for client handling. */
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_SLUG: 'INVALID_SLUG',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_NONCE: 'INVALID_NONCE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  FORBIDDEN: 'FORBIDDEN',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND',
  MARKETPLACE_NOT_FOUND: 'MARKETPLACE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DISCORD_NOT_LINKED: 'DISCORD_NOT_LINKED',
  GUILD_NOT_LINKED: 'GUILD_NOT_LINKED',
  DISCORD_SERVER_NOT_CONNECTED: 'DISCORD_SERVER_NOT_CONNECTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIG_REQUIRED: 'CONFIG_REQUIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]
