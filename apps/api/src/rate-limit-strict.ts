/**
 * Stricter per-route rate limits (e.g. auth and tenant creation).
 * Uses in-memory store keyed by client IP. Complements global @fastify/rate-limit.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { apiError, ErrorCode } from './api-errors.js'
import {
  DEFAULT_RATE_LIMIT_AUTH_MAX,
  DEFAULT_RATE_LIMIT_TENANT_CREATE_MAX,
  DEFAULT_RATE_LIMIT_DISCORD_VERIFY_MAX,
  DEFAULT_RATE_LIMIT_ADMIN_WRITE_MAX,
  RATE_LIMIT_STRICT_WINDOW_MS,
} from './config/constants.js'

interface WindowEntry {
  count: number
  resetAt: number
}

const stores = new Map<string, Map<string, WindowEntry>>()

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for']
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded : forwarded[0]
    return (first ?? '').split(',')[0].trim() || 'unknown'
  }
  return request.ip ?? 'unknown'
}

export interface StrictRateLimitOptions {
  /** Max requests per window per IP */
  max: number
  /** Window length in milliseconds */
  windowMs: number
  /** Unique name for this limit (e.g. 'auth-nonce') so it doesn't share state with others */
  name: string
}

/**
 * Returns a preHandler that enforces a stricter rate limit per client IP.
 * Use for auth (nonce, verify) and tenant creation.
 */
export function strictRateLimit(options: StrictRateLimitOptions) {
  const { max, windowMs, name } = options
  let store = stores.get(name)
  if (!store) {
    store = new Map()
    stores.set(name, store)
  }

  return async function (request: FastifyRequest, reply: FastifyReply) {
    const ip = getClientIp(request)
    const now = Date.now()
    // Prune expired entries to avoid unbounded memory under IP churn
    for (const [key, value] of store!.entries()) {
      if (now >= value.resetAt) store!.delete(key)
    }
    let entry = store!.get(ip)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      store!.set(ip, entry)
    }
    entry.count++
    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
      return reply.status(429).send(apiError('Too many requests', ErrorCode.RATE_LIMIT_EXCEEDED, { retryAfterSeconds }))
    }
  }
}

/** Auth endpoints: requests per minute per IP. Override with RATE_LIMIT_AUTH_MAX. */
export const authRateLimit = strictRateLimit({
  name: 'auth',
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || DEFAULT_RATE_LIMIT_AUTH_MAX,
  windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
})

/** Tenant creation: attempts per minute per IP. Override with RATE_LIMIT_TENANT_CREATE_MAX. */
export const tenantCreateRateLimit = strictRateLimit({
  name: 'tenant-create',
  max: Number(process.env.RATE_LIMIT_TENANT_CREATE_MAX) || DEFAULT_RATE_LIMIT_TENANT_CREATE_MAX,
  windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
})

/** Discord verify: attempts per minute per IP. Override with RATE_LIMIT_DISCORD_VERIFY_MAX. */
export const discordVerifyRateLimit = strictRateLimit({
  name: 'discord-verify',
  max: Number(process.env.RATE_LIMIT_DISCORD_VERIFY_MAX) || DEFAULT_RATE_LIMIT_DISCORD_VERIFY_MAX,
  windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
})

/** Admin write: requests per minute per IP. Override with RATE_LIMIT_ADMIN_WRITE_MAX. */
export const adminWriteRateLimit = strictRateLimit({
  name: 'admin-write',
  max: Number(process.env.RATE_LIMIT_ADMIN_WRITE_MAX) || DEFAULT_RATE_LIMIT_ADMIN_WRITE_MAX,
  windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
})
