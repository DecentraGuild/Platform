import type { FastifyInstance } from 'fastify'
import { getModuleState } from '@decentraguild/core'
import { consumeNonce } from '../auth/nonce-store.js'
import { verifyWalletSignature } from '../auth/verify-signature.js'
import { getWalletFromRequest } from './auth.js'
import { createVerifySession } from '../db/discord-verify-sessions.js'
import { getAndConsumeVerifySession, getVerifySessionStatus } from '../db/discord-verify-sessions.js'
import { resolveTenant } from '../db/tenant.js'
import { getLinkByWallet, getWalletsByDiscordUserId, linkWalletToDiscord, revokeWalletLink } from '../db/wallet-discord-links.js'
import { logDiscordAudit } from '../db/discord-audit.js'
import { requireDiscordBotAuth } from '../discord/bot-auth.js'
import { discordVerifyRateLimit } from '../rate-limit-strict.js'
import { apiError, ErrorCode } from '../api-errors.js'

/** Validates nonce + signature, checks wallet not linked to another Discord user, then links. Returns error response args or null on success. */
async function verifyAndLinkWallet(
  wallet: string,
  message: string,
  signature: string,
  discordUserId: string,
  discordGuildId: string | null
): Promise<{ status: number; error: string; code: string } | null> {
  if (!(await consumeNonce(wallet, message))) {
    return { status: 401, error: 'Invalid or expired nonce', code: ErrorCode.INVALID_NONCE }
  }
  const valid = await verifyWalletSignature(wallet, message, signature)
  if (!valid) {
    return { status: 401, error: 'Invalid signature', code: ErrorCode.INVALID_SIGNATURE }
  }
  const existing = await getLinkByWallet(wallet)
  if (existing && existing.discord_user_id !== discordUserId) {
    return { status: 409, error: 'Wallet already linked to another Discord account', code: ErrorCode.CONFLICT }
  }
  await linkWalletToDiscord(wallet, discordUserId)
  await logDiscordAudit('verify_link', { wallet, discord_user_id: discordUserId }, discordGuildId)
  return null
}

export async function registerDiscordVerifyRoutes(app: FastifyInstance) {
  // Authenticated: return current user's Discord link and all wallets linked to that Discord account (global, not per-tenant).
  app.get('/api/v1/discord/me', async (request, reply) => {
    const wallet = await getWalletFromRequest(request)
    if (!wallet) {
      return reply.status(401).send(apiError('Sign in with a wallet to see your Discord link', ErrorCode.UNAUTHORIZED))
    }
    const link = await getLinkByWallet(wallet)
    if (!link) {
      return reply.send({ discord_user_id: null, linked_wallets: [], session_wallet: wallet })
    }
    const linkedWallets = await getWalletsByDiscordUserId(link.discord_user_id)
    return reply.send({
      discord_user_id: link.discord_user_id,
      linked_wallets: linkedWallets,
      session_wallet: wallet,
    })
  })

  // Authenticated: link an additional wallet to the same Discord account as the session wallet. Body: wallet, message, signature, optional tenant_slug.
  // When tenant_slug is provided, rejects if that tenant's Discord module is not active (e.g. deactivating).
  app.post<{
    Body: { wallet: string; message: string; signature: string; tenant_slug?: string }
  }>('/api/v1/discord/link-additional-wallet', { preHandler: [discordVerifyRateLimit] }, async (request, reply) => {
    const sessionWallet = await getWalletFromRequest(request)
    if (!sessionWallet) {
      return reply.status(401).send(apiError('Sign in with a wallet first', ErrorCode.UNAUTHORIZED))
    }
    const { wallet, message, signature, tenant_slug } = request.body ?? {}
    if (!wallet || !message || !signature) {
      return reply.status(400).send(apiError('wallet, message, and signature required', ErrorCode.BAD_REQUEST))
    }
    if (tenant_slug && typeof tenant_slug === 'string' && tenant_slug.trim()) {
      const tenant = await resolveTenant(tenant_slug.trim())
      const discordState = getModuleState(tenant?.modules?.discord)
      if (discordState !== 'active') {
        return reply.status(403).send(apiError(
          'Discord module is not accepting new wallet links for this community',
          ErrorCode.FORBIDDEN
        ))
      }
    }
    const link = await getLinkByWallet(sessionWallet)
    if (!link) {
      return reply.status(400).send(apiError(
        'Your current wallet is not linked to Discord. Use /verify in your Discord server first, then add more wallets here.',
        ErrorCode.DISCORD_NOT_LINKED
      ))
    }
    const err = await verifyAndLinkWallet(wallet, message, signature, link.discord_user_id, null)
    if (err) return reply.status(err.status).send(apiError(err.error, err.code))
    return reply.send({ ok: true })
  })

  // Bot: create a verify session for a Discord user in this guild. Returns token and expiry; bot builds verify URL.
  app.post<{
    Body: { discord_user_id: string }
  }>(
    '/api/v1/discord/bot/verify/session',
    { preHandler: [requireDiscordBotAuth] },
    async (request, reply) => {
      const ctx = request.discordContext!
      const discordUserId = request.body?.discord_user_id
      if (!discordUserId || typeof discordUserId !== 'string') {
        return reply.status(400).send(apiError('discord_user_id required', ErrorCode.BAD_REQUEST))
      }
      const { token, expiresAt } = await createVerifySession(discordUserId, ctx.discordGuildId)
      return reply.send({
        verify_token: token,
        expires_at: expiresAt.toISOString(),
        tenant_slug: ctx.tenantSlug,
      })
    }
  )

  // Public: check if verify token is still valid (e.g. for verify page).
  app.get<{ Querystring: { token: string } }>(
    '/api/v1/discord/verify/session',
    async (request, reply) => {
      const token = request.query?.token
      if (!token) return reply.status(400).send(apiError('token required', ErrorCode.BAD_REQUEST))
      const status = await getVerifySessionStatus(token)
      return reply.send(status)
    }
  )

  // Public: complete wallet link. Body: verify_token, wallet, message, signature. Enforces one wallet -> one Discord user.
  app.post<{
    Body: { verify_token: string; wallet: string; message: string; signature: string }
  }>(
    '/api/v1/discord/verify/link',
    { preHandler: [discordVerifyRateLimit] },
    async (request, reply) => {
      const { verify_token, wallet, message, signature } = request.body ?? {}
      if (!verify_token || !wallet || !message || !signature) {
        return reply.status(400).send(apiError('verify_token, wallet, message, and signature required', ErrorCode.BAD_REQUEST))
      }
      const session = await getAndConsumeVerifySession(verify_token)
      if (!session) {
        return reply.status(400).send(apiError('Invalid or expired verify token', ErrorCode.BAD_REQUEST))
      }
      const err = await verifyAndLinkWallet(wallet, message, signature, session.discordUserId, session.discordGuildId)
      if (err) return reply.status(err.status).send(apiError(err.error, err.code))
      return reply.send({ ok: true })
    }
  )

  // User-initiated revoke: with session, can revoke session wallet or any other wallet in the same Discord account (body.wallet).
  // Without session: body must have wallet + message + signature to revoke that wallet.
  app.post<{
    Body: { wallet?: string; message?: string; signature?: string }
  }>(
    '/api/v1/discord/verify/revoke',
    { preHandler: [discordVerifyRateLimit] },
    async (request, reply) => {
      const cookieWallet = await getWalletFromRequest(request)
      const body = request.body ?? {}
      const targetWallet = typeof body.wallet === 'string' && body.wallet.trim() ? body.wallet.trim() : null

      if (cookieWallet) {
        let toRevoke: string
        if (targetWallet && targetWallet !== cookieWallet) {
          const sessionLink = await getLinkByWallet(cookieWallet)
          if (!sessionLink) {
            return reply.status(400).send(apiError('Your wallet is not linked to Discord', ErrorCode.DISCORD_NOT_LINKED))
          }
          const linked = await getWalletsByDiscordUserId(sessionLink.discord_user_id)
          if (!linked.includes(targetWallet)) {
            return reply.status(403).send(apiError('That wallet is not linked to your Discord account', ErrorCode.FORBIDDEN))
          }
          toRevoke = targetWallet
        } else {
          toRevoke = cookieWallet
        }
        const removed = await revokeWalletLink(toRevoke)
        if (removed) {
          await logDiscordAudit('verify_revoke', { wallet: toRevoke }, null)
        }
        return reply.send({ ok: true, revoked: removed })
      }

      if (!targetWallet || body.message === undefined || body.signature === undefined) {
        return reply.status(400).send(apiError('Sign in with a wallet, or provide wallet, message, and signature', ErrorCode.BAD_REQUEST))
      }
      if (!(await consumeNonce(targetWallet, body.message as string))) {
        return reply.status(401).send(apiError('Invalid or expired nonce', ErrorCode.INVALID_NONCE))
      }
      const valid = await verifyWalletSignature(targetWallet, body.message as string, body.signature as string)
      if (!valid) return reply.status(401).send(apiError('Invalid signature', ErrorCode.INVALID_SIGNATURE))
      const removed = await revokeWalletLink(targetWallet)
      if (removed) {
        await logDiscordAudit('verify_revoke', { wallet: targetWallet }, null)
      }
      return reply.send({ ok: true, revoked: removed })
    }
  )
}
