import type { FastifyInstance } from 'fastify'
import type { BillingPeriod, ConditionSet } from '@decentraguild/billing'
import { getModuleCatalogEntry, getModuleDisplayName, VALID_BILLING_PERIODS } from '@decentraguild/config'
import { requireTenantAdmin } from './tenant-settings.js'
import { getWalletFromRequest } from './auth.js'
import { apiError, ErrorCode } from '../api-errors.js'
import { adminWriteRateLimit } from '../rate-limit-strict.js'
import { getPool } from '../db/client.js'
import { verifyBillingPayment, BILLING_WALLET } from '../billing/verify-payment.js'
import {
  createPaymentIntent,
  confirmPayment,
  extendSubscription,
  tenantBillingKey,
} from '../billing/service.js'
import { getPaymentById, listPayments } from '../db/billing.js'
import { getSubscription } from '../db/billing.js'
import { getModuleBillingState } from '../db/module-billing-state.js'

export async function registerBillingPaymentRoutes(app: FastifyInstance) {
  app.post<{
    Params: { slug: string }
    Body: { moduleId: string; billingPeriod?: string; conditions?: ConditionSet; slug?: string }
  }>(
    '/api/v1/tenant/:slug/billing/payment-intent',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return

      if (!getPool()) {
        return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const body = request.body ?? ({} as Record<string, unknown>)
      const moduleId = body.moduleId
      if (!moduleId || typeof moduleId !== 'string') {
        return reply.status(400).send(apiError('moduleId is required', ErrorCode.BAD_REQUEST))
      }

      const catalogEntry = getModuleCatalogEntry(moduleId)
      if (!catalogEntry?.pricing) {
        return reply.status(400).send(apiError('Module is not billable', ErrorCode.BAD_REQUEST))
      }

      if (moduleId !== 'slug') {
        const billingPeriod = (body.billingPeriod ?? 'monthly') as string
        if (!VALID_BILLING_PERIODS.has(billingPeriod)) {
          return reply.status(400).send(apiError('billingPeriod must be "monthly" or "yearly"', ErrorCode.BAD_REQUEST))
        }
      }

      const wallet = await getWalletFromRequest(request)
      if (!wallet) {
        return reply.status(401).send(apiError('Authentication required', ErrorCode.UNAUTHORIZED))
      }

      try {
        const intent = await createPaymentIntent({
          tenant: result.tenant,
          moduleId,
          billingPeriod: body.billingPeriod as BillingPeriod | undefined,
          conditions: body.conditions && typeof body.conditions === 'object' ? body.conditions : undefined,
          slug: typeof body.slug === 'string' ? body.slug : undefined,
          payerWallet: wallet,
        })
        return intent
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('slug') && (message.includes('required') || message.includes('Invalid') || message.includes('available') || message.includes('already'))) {
          return reply.status(400).send(apiError(message, ErrorCode.INVALID_SLUG))
        }
        return reply.status(400).send(apiError(message, ErrorCode.BAD_REQUEST))
      }
    },
  )

  app.post<{
    Params: { slug: string }
    Body: { paymentId: string; txSignature: string }
  }>(
    '/api/v1/tenant/:slug/billing/confirm-payment',
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

      if (payment.status !== 'pending' && payment.status !== 'confirmed') {
        return reply.status(400).send(apiError(`Payment is ${payment.status}`, ErrorCode.BAD_REQUEST))
      }

      if (payment.status === 'pending' && payment.expiresAt < new Date()) {
        const { failPayment } = await import('../db/billing.js')
        await failPayment(paymentId)
        return reply.status(400).send(apiError('Payment intent has expired', ErrorCode.BAD_REQUEST))
      }

      if (payment.status === 'pending') {
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
          subscription: confirmResult.subscription,
          tenant: confirmResult.tenant,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(400).send(apiError(message, ErrorCode.BAD_REQUEST))
      }
    },
  )

  app.get<{
    Params: { slug: string }
    Querystring: { limit?: string; offset?: string }
  }>('/api/v1/tenant/:slug/billing/payments', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return

    if (!getPool()) {
      return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
    }

    const limit = Math.min(Math.max(1, Number(request.query.limit) || 50), 100)
    const offset = Math.max(0, Number(request.query.offset) || 0)

    const payments = await listPayments(tenantBillingKey(result.tenant), { limit, offset })
    return { payments }
  })

  app.get<{
    Params: { slug: string; paymentId: string }
  }>('/api/v1/tenant/:slug/billing/payments/:paymentId/invoice', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return

    if (!getPool()) {
      return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
    }

    const payment = await getPaymentById(request.params.paymentId)
    if (!payment || payment.tenantSlug !== tenantBillingKey(result.tenant)) {
      return reply.status(404).send(apiError('Payment not found', ErrorCode.NOT_FOUND))
    }
    if (payment.status !== 'confirmed') {
      return reply.status(400).send(apiError('Invoice only available for confirmed payments', ErrorCode.BAD_REQUEST))
    }

    const snapshot = payment.priceSnapshot as Record<string, unknown> | null

    return {
      invoice: {
        paymentId: payment.id,
        tenant: {
          slug: result.tenant.slug ?? result.tenant.id,
          name: result.tenant.name,
        },
        module: {
          id: payment.moduleId,
          name: getModuleDisplayName(payment.moduleId),
        },
        amountUsdc: payment.amountUsdc,
        billingPeriod: payment.billingPeriod,
        paymentType: payment.paymentType,
        periodStart: payment.periodStart.toISOString(),
        periodEnd: payment.periodEnd.toISOString(),
        txSignature: payment.txSignature,
        paidAt: payment.confirmedAt?.toISOString() ?? null,
        paidBy: payment.payerWallet,
        recipientWallet: BILLING_WALLET.toBase58(),
        previousTierName: snapshot?.previousTierName ?? null,
        newTierName: snapshot?.newTierName ?? null,
        remainingDays: snapshot?.remainingDays ?? null,
      },
    }
  })

  app.get<{
    Params: { slug: string; moduleId: string }
  }>('/api/v1/tenant/:slug/billing/subscription/:moduleId', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return

    if (!getPool()) {
      return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
    }

    const billingKey = tenantBillingKey(result.tenant)
    const moduleId = request.params.moduleId
    const sub = await getSubscription(billingKey, moduleId)
    if (sub) {
      const selectedTierId =
        sub.priceSnapshot && typeof sub.priceSnapshot === 'object' && 'selectedTierId' in sub.priceSnapshot
          ? (sub.priceSnapshot as { selectedTierId?: string }).selectedTierId
          : undefined
      return {
        subscription: {
          billingPeriod: sub.billingPeriod,
          periodEnd: sub.periodEnd.toISOString(),
          recurringAmountUsdc: sub.recurringAmountUsdc,
          periodStart: sub.periodStart.toISOString(),
          ...(selectedTierId != null ? { selectedTierId } : {}),
        },
      }
    }

    const state = await getModuleBillingState(billingKey, moduleId)
    if (!state) {
      return { subscription: null }
    }
    return {
      subscription: {
        billingPeriod: 'monthly',
        periodEnd: state.periodEnd ? state.periodEnd.toISOString() : new Date(0).toISOString(),
        recurringAmountUsdc: 0,
        periodStart: state.periodEnd ? state.periodEnd.toISOString() : new Date(0).toISOString(),
        ...(state.selectedTierId != null ? { selectedTierId: state.selectedTierId } : {}),
      },
    }
  })

  app.post<{
    Params: { slug: string }
    Body: { moduleId: string; billingPeriod?: string }
  }>(
    '/api/v1/tenant/:slug/billing/extend',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return

      if (!getPool()) {
        return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const body = request.body ?? ({} as Record<string, unknown>)
      const moduleId = body.moduleId
      if (!moduleId || typeof moduleId !== 'string') {
        return reply.status(400).send(apiError('moduleId is required', ErrorCode.BAD_REQUEST))
      }

      const catalogEntry = getModuleCatalogEntry(moduleId)
      if (!catalogEntry?.pricing) {
        return reply.status(400).send(apiError('Module is not billable', ErrorCode.BAD_REQUEST))
      }

      const billingPeriod = (body.billingPeriod ?? 'monthly') as string
      if (!VALID_BILLING_PERIODS.has(billingPeriod)) {
        return reply.status(400).send(apiError('billingPeriod must be "monthly" or "yearly"', ErrorCode.BAD_REQUEST))
      }

      const wallet = await getWalletFromRequest(request)
      if (!wallet) {
        return reply.status(401).send(apiError('Authentication required', ErrorCode.UNAUTHORIZED))
      }

      try {
        const intent = await extendSubscription({
          tenant: result.tenant,
          moduleId,
          billingPeriod: billingPeriod as BillingPeriod,
          payerWallet: wallet,
        })
        return intent
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(400).send(apiError(message, ErrorCode.BAD_REQUEST))
      }
    },
  )
}
