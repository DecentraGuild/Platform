import type { FastifyInstance, FastifyRequest } from 'fastify'
import { randomBytes } from 'node:crypto'
import {
  createSessionToken,
  verifySessionToken,
  getCookieName,
  getCookieOptions,
} from '../auth/session.js'
import { setNonce, consumeNonce } from '../auth/nonce-store.js'
import { verifyWalletSignature } from '../auth/verify-signature.js'

const NONCE_BYTES = 32

function getTokenFromCookie(request: FastifyRequest): string | null {
  const cookieName = getCookieName()
  const cookie = request.cookies[cookieName]
  return cookie ?? null
}

export async function getWalletFromRequest(request: FastifyRequest): Promise<string | null> {
  const token = getTokenFromCookie(request)
  if (!token) return null
  const payload = await verifySessionToken(token)
  return payload?.wallet ?? null
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { wallet: string } }>('/api/v1/auth/nonce', async (request, reply) => {
    const wallet = request.body?.wallet
    if (!wallet || typeof wallet !== 'string') {
      return reply.status(400).send({ error: 'wallet (base58 public key) required' })
    }
    const nonce = randomBytes(NONCE_BYTES).toString('base64')
    setNonce(wallet, nonce)
    return { nonce }
  })

  app.post<{
    Body: { wallet: string; signature: string; message: string }
  }>('/api/v1/auth/verify', async (request, reply) => {
    const { wallet, signature, message } = request.body ?? {}
    if (!wallet || !signature || !message) {
      return reply.status(400).send({ error: 'wallet, signature, and message required' })
    }
    if (!consumeNonce(wallet, message)) {
      return reply.status(401).send({ error: 'Invalid or expired nonce' })
    }
    const valid = await verifyWalletSignature(wallet, message, signature)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid signature' })
    }
    try {
      const token = await createSessionToken(wallet)
      const secure = request.headers['x-forwarded-proto'] === 'https'
      const cookieOptions = getCookieOptions(secure)
      return reply
        .setCookie(getCookieName(), token, cookieOptions)
        .send({ ok: true })
    } catch (err) {
      request.log.error({ err }, 'Auth verify: session or cookie failed')
      return reply.status(500).send({ error: 'Session creation failed' })
    }
  })

  app.get('/api/v1/auth/me', async (request, reply) => {
    const token = getTokenFromCookie(request)
    if (!token) {
      return reply.status(401).send({ error: 'Not authenticated' })
    }
    const payload = await verifySessionToken(token)
    if (!payload) {
      return reply.status(401).send({ error: 'Invalid or expired session' })
    }
    return { wallet: payload.wallet }
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const cookieName = getCookieName()
    const secure = request.headers['x-forwarded-proto'] === 'https'
    const opts = { path: '/', sameSite: (secure ? 'none' : 'lax') as const, secure }
    return reply
      .clearCookie(cookieName, opts)
      .send({ ok: true })
  })
}
