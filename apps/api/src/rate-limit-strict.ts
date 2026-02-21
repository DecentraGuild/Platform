/**
 * Stricter per-route rate limits (e.g. auth and tenant creation).
 * Uses in-memory store keyed by client IP. Complements global @fastify/rate-limit.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'

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
    let entry = store!.get(ip)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      store!.set(ip, entry)
    }
    entry.count++
    if (entry.count > max) {
      return reply.status(429).send({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)} seconds.`,
      })
    }
  }
}

/** 10 requests per minute per IP for auth endpoints */
export const authRateLimit = strictRateLimit({
  name: 'auth',
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
  windowMs: 60 * 1000,
})

/** 5 tenant creation attempts per minute per IP */
export const tenantCreateRateLimit = strictRateLimit({
  name: 'tenant-create',
  max: Number(process.env.RATE_LIMIT_TENANT_CREATE_MAX) || 5,
  windowMs: 60 * 1000,
})

/** 20 verify/link attempts per minute per IP (public Discord verify flow) */
export const discordVerifyRateLimit = strictRateLimit({
  name: 'discord-verify',
  max: Number(process.env.RATE_LIMIT_DISCORD_VERIFY_MAX) || 20,
  windowMs: 60 * 1000,
})
