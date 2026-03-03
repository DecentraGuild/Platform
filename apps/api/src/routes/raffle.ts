import type { FastifyInstance } from 'fastify'
import { requireTenantAdmin } from './tenant-settings.js'
import { getWalletFromRequest } from './auth.js'
import { apiError, ErrorCode } from '../api-errors.js'
import { adminWriteRateLimit } from '../rate-limit-strict.js'
import { getPool } from '../db/client.js'
import {
  createRafflePaymentIntent,
  confirmPayment,
  tenantBillingKey,
} from '../billing/service.js'
import { getPaymentById } from '../db/billing.js'
import {
  registerRaffle,
  closeRaffle,
  listRaffles,
  getRaffleSettings,
  upsertRaffleSettings,
  type RaffleSettings,
} from '../db/raffle.js'
import { normalizeTenantIdentifier } from '../validate-slug.js'
import { resolveTenant } from '../db/tenant.js'

const DEFAULT_WHITELIST_PROGRAM = 'whi5uDPWK4rAE9Sus6hdxdHwsG1hjDBn6kXM6pyqwTn'

export async function registerRaffleRoutes(app: FastifyInstance) {
  app.post<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/billing/create-raffle-payment',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return

      if (!getPool()) {
        return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const wallet = await getWalletFromRequest(request)
      if (!wallet) {
        return reply.status(401).send(apiError('Authentication required', ErrorCode.UNAUTHORIZED))
      }

      try {
        const intent = await createRafflePaymentIntent({
          tenant: result.tenant,
          payerWallet: wallet,
        })
        return intent
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(400).send(apiError(message, ErrorCode.BAD_REQUEST))
      }
    },
  )

  app.post<{
    Params: { slug: string }
    Body: { paymentId: string; txSignature: string }
  }>(
    '/api/v1/tenant/:slug/billing/confirm-raffle-payment',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return

      if (!getPool()) {
        return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const body = request.body ?? ({} as Record<string, unknown>)
      const { paymentId, txSignature } = body
      if (!paymentId || typeof paymentId !== 'string') {
        return reply.status(400).send(apiError('paymentId is required', ErrorCode.BAD_REQUEST))
      }
      if (!txSignature || typeof txSignature !== 'string') {
        return reply.status(400).send(apiError('txSignature is required', ErrorCode.BAD_REQUEST))
      }

      const payment = await getPaymentById(paymentId)
      if (!payment) {
        return reply.status(404).send(apiError('Payment not found', ErrorCode.NOT_FOUND))
      }
      if (payment.tenantSlug !== tenantBillingKey(result.tenant)) {
        return reply.status(403).send(apiError('Payment does not belong to this tenant', ErrorCode.FORBIDDEN))
      }
      if (payment.moduleId !== 'raffles' || payment.paymentType !== 'add_unit') {
        return reply.status(400).send(apiError('Invalid payment type for raffle', ErrorCode.BAD_REQUEST))
      }

      if (payment.status !== 'pending' && payment.status !== 'confirmed') {
        return reply.status(400).send(apiError(`Payment is ${payment.status}`, ErrorCode.BAD_REQUEST))
      }

      if (payment.status === 'pending' && payment.expiresAt < new Date()) {
        const { failPayment } = await import('../db/billing.js')
        await failPayment(paymentId)
        return reply.status(400).send(apiError('Payment intent has expired', ErrorCode.BAD_REQUEST))
      }

      if (payment.status === 'pending') {
        const { verifyBillingPayment } = await import('../billing/verify-payment.js')
        const verification = await verifyBillingPayment({
          txSignature,
          expectedAmountUsdc: payment.amountUsdc,
          expectedMemo: payment.memo,
        })
        if (!verification.valid) {
          const { failPayment } = await import('../db/billing.js')
          await failPayment(paymentId)
          return reply.status(400).send(
            apiError(verification.error ?? 'Transaction verification failed', ErrorCode.BAD_REQUEST),
          )
        }
      }

      try {
        const confirmResult = await confirmPayment({
          tenant: result.tenant,
          paymentId,
          txSignature,
        })
        return {
          success: true,
          alreadyConfirmed: confirmResult.alreadyConfirmed ?? false,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(400).send(apiError(message, ErrorCode.BAD_REQUEST))
      }
    },
  )

  app.post<{
    Params: { slug: string }
    Body: { rafflePubkey: string }
  }>(
    '/api/v1/tenant/:slug/raffles',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return

      if (!getPool()) {
        return reply.status(503).send(apiError('Database required', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const body = request.body ?? ({} as Record<string, unknown>)
      const rafflePubkey = body.rafflePubkey
      if (!rafflePubkey || typeof rafflePubkey !== 'string' || !rafflePubkey.trim()) {
        return reply.status(400).send(apiError('rafflePubkey is required', ErrorCode.BAD_REQUEST))
      }

      const tenantSlug = result.tenant.id
      const raffle = await registerRaffle(tenantSlug, rafflePubkey.trim())
      return { raffle: { id: raffle.id, rafflePubkey: raffle.raffle_pubkey, createdAt: raffle.created_at } }
    },
  )

  app.patch<{
    Params: { slug: string; rafflePubkey: string }
  }>(
    '/api/v1/tenant/:slug/raffles/:rafflePubkey/close',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return

      if (!getPool()) {
        return reply.status(503).send(apiError('Database required', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const rafflePubkey = request.params.rafflePubkey?.trim()
      if (!rafflePubkey) {
        return reply.status(400).send(apiError('rafflePubkey is required', ErrorCode.BAD_REQUEST))
      }

      const tenantSlug = result.tenant.id
      const closed = await closeRaffle(tenantSlug, rafflePubkey)
      if (!closed) {
        return reply.status(404).send(apiError('Raffle not found or already closed', ErrorCode.NOT_FOUND))
      }
      return { success: true }
    },
  )

  app.get<{ Params: { slug: string } }>('/api/v1/tenant/:slug/raffles', async (request, reply) => {
    const slug = normalizeTenantIdentifier(request.params.slug)
    if (!slug) {
      return reply.status(400).send(apiError('Invalid tenant identifier', ErrorCode.BAD_REQUEST))
    }

    const tenant = await resolveTenant(slug)
    if (!tenant) {
      return reply.status(404).send(apiError('Tenant not found', ErrorCode.TENANT_NOT_FOUND))
    }

    if (!getPool()) {
      return reply.status(503).send(apiError('Database required', ErrorCode.SERVICE_UNAVAILABLE))
    }

    const raffles = await listRaffles(tenant.id)
    return {
      raffles: raffles.map((r) => ({
        id: r.id,
        rafflePubkey: r.raffle_pubkey,
        createdAt: r.created_at,
        closedAt: r.closed_at,
      })),
    }
  })

  app.get<{ Params: { slug: string } }>('/api/v1/tenant/:slug/raffle-settings', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return

    if (!getPool()) {
      return { settings: {} }
    }

    const settings = await getRaffleSettings(result.tenant.id)
    return { settings: settings ?? {} }
  })

  app.patch<{
    Params: { slug: string }
    Body: { defaultWhitelist?: { programId?: string; account?: string } | 'use-default' | null }
  }>(
    '/api/v1/tenant/:slug/raffle-settings',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return

      if (!getPool()) {
        return reply.status(503).send(apiError('Database required', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const body = (request.body ?? {}) as Record<string, unknown>
      const wlRaw = body.defaultWhitelist

      let defaultWhitelist: RaffleSettings['defaultWhitelist']
      if (wlRaw === 'use-default') {
        defaultWhitelist = 'use-default'
      } else if (wlRaw === null || wlRaw === undefined) {
        defaultWhitelist = null
      } else if (typeof wlRaw === 'object' && wlRaw) {
        const acc = (wlRaw.account as string)?.trim()
        if (!acc) {
          defaultWhitelist = null
        } else {
          defaultWhitelist = {
            programId: ((wlRaw.programId as string)?.trim()) || DEFAULT_WHITELIST_PROGRAM,
            account: acc,
          }
        }
      } else {
        defaultWhitelist = null
      }

      const settings: RaffleSettings = { defaultWhitelist }
      await upsertRaffleSettings(result.tenant.id, result.tenant.id, settings)
      return { settings }
    },
  )
}
