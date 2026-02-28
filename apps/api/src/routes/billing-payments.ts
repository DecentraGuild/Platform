import type { FastifyInstance } from 'fastify'
import type { BillingPeriod, ConditionSet } from '@decentraguild/billing'
import { computePrice } from '@decentraguild/billing'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { requireTenantAdmin } from './tenant-settings.js'
import { getWalletFromRequest } from './auth.js'
import { apiError, ErrorCode } from '../api-errors.js'
import { adminWriteRateLimit } from '../rate-limit-strict.js'
import { getPool } from '../db/client.js'
import { getConditions } from '../billing/conditions.js'
import { calculateCharge, calculateExtension } from '../billing/prorate.js'
import { verifyBillingPayment, BILLING_WALLET, BILLING_WALLET_ATA } from '../billing/verify-payment.js'
import {
  getSubscription,
  insertPaymentIntent,
  getPaymentById,
  confirmPaymentAndActivate,
  confirmSlugClaimPayment,
  failPayment,
  expireStalePendingPayments,
  listPayments,
} from '../db/billing.js'
import { getTenantBySlug, resolveTenant } from '../db/tenant.js'
import { loadTenantByIdOrSlug } from '../config/registry.js'
import { normalizeTenantSlug } from '../validate-slug.js'

const VALID_BILLING_PERIODS: ReadonlySet<string> = new Set(['monthly', 'yearly'])

const MODULE_NAV: Record<string, string> = {
  marketplace: 'Marketplace',
  discord: 'Discord',
  raffles: 'Raffle',
  whitelist: 'Whitelist',
  minting: 'Mint',
  slug: 'Custom slug',
}

export async function registerBillingPaymentRoutes(app: FastifyInstance) {
  /* ---------------------------------------------------------------- */
  /*  POST /billing/payment-intent                                     */
  /* ---------------------------------------------------------------- */

  /** Billing always uses tenant id (permanent); slug can change. */
  const tenantBillingKey = (tenant: { id: string }) => tenant.id

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

      let billingPeriod = (body.billingPeriod ?? 'monthly') as string
      if (moduleId === 'slug') {
        billingPeriod = 'yearly'
        const desiredSlug = body.slug
        if (!desiredSlug || typeof desiredSlug !== 'string') {
          return reply.status(400).send(apiError('slug is required when claiming custom slug', ErrorCode.BAD_REQUEST))
        }
        const normalized = normalizeTenantSlug(desiredSlug.trim())
        if (!normalized) {
          return reply.status(400).send(apiError('Invalid slug: use only lowercase letters, numbers, and hyphens (1–64 chars)', ErrorCode.INVALID_SLUG))
        }
        if (result.tenant.slug) {
          return reply.status(400).send(apiError('Tenant already has a custom slug', ErrorCode.BAD_REQUEST))
        }
        const existingDb = await getTenantBySlug(normalized)
        const existingFile = await loadTenantByIdOrSlug(normalized)
        if (existingDb || existingFile) {
          return reply.status(400).send(apiError('Slug is not available', ErrorCode.BAD_REQUEST))
        }
      } else if (!VALID_BILLING_PERIODS.has(billingPeriod)) {
        return reply.status(400).send(apiError('billingPeriod must be "monthly" or "yearly"', ErrorCode.BAD_REQUEST))
      }

      const wallet = await getWalletFromRequest(request)
      if (!wallet) {
        return reply.status(401).send(apiError('Authentication required', ErrorCode.UNAUTHORIZED))
      }

      const billingKey = tenantBillingKey(result.tenant)
      const conditionsLookupId = result.tenant.id
      const conditions: ConditionSet =
        body.conditions && typeof body.conditions === 'object'
          ? body.conditions
          : await getConditions(moduleId, conditionsLookupId)
      if (moduleId === 'slug') {
        const desiredSlug = normalizeTenantSlug((body.slug as string)?.trim())
        if (desiredSlug) (conditions as Record<string, unknown>).slugToClaim = desiredSlug
      }

      const price = computePrice(moduleId, conditions, catalogEntry.pricing, {
        billingPeriod: billingPeriod as BillingPeriod,
      })

      await expireStalePendingPayments().catch(() => {})

      const existing = await getSubscription(billingKey, moduleId)
      const charge = calculateCharge(price, billingPeriod as BillingPeriod, existing)

      if (charge.noPaymentRequired) {
        return {
          noPaymentRequired: true,
          amountUsdc: 0,
          billingPeriod,
          periodStart: charge.periodStart.toISOString(),
          periodEnd: charge.periodEnd.toISOString(),
        }
      }

      const enrichedSnapshot: Record<string, unknown> = { ...price }
      if (charge.paymentType === 'upgrade_prorate' && existing && catalogEntry.pricing?.modelType === 'tiered_addons') {
        const tiers = (catalogEntry.pricing as { tiers?: Array<{ id: string; name: string }> }).tiers
        const prevTierId = (existing.priceSnapshot as { selectedTierId?: string })?.selectedTierId
        const prevTier = prevTierId && tiers ? tiers.find((t) => t.id === prevTierId) : null
        const newTier = price.selectedTierId && tiers ? tiers.find((t) => t.id === price.selectedTierId) : null
        if (prevTier) enrichedSnapshot.previousTierName = prevTier.name
        if (newTier) enrichedSnapshot.newTierName = newTier.name
        if (charge.remainingDays != null) enrichedSnapshot.remainingDays = charge.remainingDays
      }

      const payment = await insertPaymentIntent({
        tenantSlug: billingKey,
        moduleId,
        paymentType: charge.paymentType,
        amountUsdc: charge.amountUsdc,
        billingPeriod: billingPeriod as BillingPeriod,
        periodStart: charge.periodStart,
        periodEnd: charge.periodEnd,
        payerWallet: wallet,
        conditionsSnapshot: conditions,
        priceSnapshot: enrichedSnapshot as unknown as typeof price,
      })

      return {
        noPaymentRequired: false,
        paymentId: payment.id,
        amountUsdc: payment.amountUsdc,
        memo: payment.memo,
        recipientWallet: BILLING_WALLET.toBase58(),
        recipientAta: BILLING_WALLET_ATA.toBase58(),
        billingPeriod,
        periodStart: charge.periodStart.toISOString(),
        periodEnd: charge.periodEnd.toISOString(),
      }
    },
  )

  /* ---------------------------------------------------------------- */
  /*  POST /billing/confirm-payment                                    */
  /* ---------------------------------------------------------------- */

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
      const billingKey = tenantBillingKey(result.tenant)
      if (payment.tenantSlug !== billingKey) {
        return reply.status(403).send(apiError('Payment does not belong to this tenant', ErrorCode.FORBIDDEN))
      }

      const resolveBy = result.tenant.id
      if (payment.status === 'confirmed') {
        const tenant = await resolveTenant(resolveBy)
        return { success: true, alreadyConfirmed: true, tenant }
      }

      if (payment.status !== 'pending') {
        return reply.status(400).send(apiError(`Payment is ${payment.status}`, ErrorCode.BAD_REQUEST))
      }

      if (payment.expiresAt < new Date()) {
        await failPayment(paymentId)
        return reply.status(400).send(apiError('Payment intent has expired', ErrorCode.BAD_REQUEST))
      }

      const verification = await verifyBillingPayment({
        txSignature,
        expectedAmountUsdc: payment.amountUsdc,
        expectedMemo: payment.memo,
      })

      if (!verification.valid) {
        await failPayment(paymentId)
        return reply.status(400).send(
          apiError(
            verification.error ?? 'Transaction verification failed',
            ErrorCode.BAD_REQUEST,
          ),
        )
      }

      const conditions = payment.conditionsSnapshot ?? {}
      const priceSnapshot = payment.priceSnapshot ?? ({} as never)
      const recurringAmountUsdc = payment.priceSnapshot
        ? payment.billingPeriod === 'yearly'
          ? payment.priceSnapshot.recurringYearly
          : payment.priceSnapshot.recurringMonthly
        : payment.amountUsdc

      let subscription
      let tenant = await resolveTenant(resolveBy)
      if (payment.moduleId === 'slug') {
        const slugToClaim = (conditions as Record<string, unknown>).slugToClaim
        if (typeof slugToClaim !== 'string' || !slugToClaim) {
          await failPayment(paymentId)
          return reply.status(400).send(apiError('Slug claim payment missing slug', ErrorCode.BAD_REQUEST))
        }
        const { subscription: sub } = await confirmSlugClaimPayment({
          paymentId,
          txSignature,
          tenantId: result.tenant.id,
          newSlug: slugToClaim,
          billingPeriod: payment.billingPeriod,
          recurringAmountUsdc,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          conditionsSnapshot: conditions,
          priceSnapshot,
        })
        subscription = sub
        const updated = await resolveTenant(slugToClaim)
        tenant = updated ?? tenant
      } else {
        const result2 = await confirmPaymentAndActivate({
          paymentId,
          txSignature,
          tenantSlug: billingKey,
          moduleId: payment.moduleId,
          billingPeriod: payment.billingPeriod,
          recurringAmountUsdc,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          conditionsSnapshot: conditions,
          priceSnapshot,
        })
        subscription = result2.subscription
      }

      return { success: true, subscription, tenant }
    },
  )

  /* ---------------------------------------------------------------- */
  /*  GET /billing/payments                                            */
  /* ---------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------- */
  /*  GET /billing/payments/:paymentId/invoice                         */
  /* ---------------------------------------------------------------- */

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
          name: MODULE_NAV[payment.moduleId] ?? payment.moduleId,
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

  /* ---------------------------------------------------------------- */
  /*  GET /billing/subscription/:moduleId                              */
  /* ---------------------------------------------------------------- */

  app.get<{
    Params: { slug: string; moduleId: string }
  }>('/api/v1/tenant/:slug/billing/subscription/:moduleId', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return

    if (!getPool()) {
      return reply.status(503).send(apiError('Database required for billing', ErrorCode.SERVICE_UNAVAILABLE))
    }

    const sub = await getSubscription(tenantBillingKey(result.tenant), request.params.moduleId)
    if (!sub) {
      return { subscription: null }
    }

    return {
      subscription: {
        billingPeriod: sub.billingPeriod,
        periodEnd: sub.periodEnd.toISOString(),
        recurringAmountUsdc: sub.recurringAmountUsdc,
        periodStart: sub.periodStart.toISOString(),
      },
    }
  })

  /* ---------------------------------------------------------------- */
  /*  POST /billing/extend                                             */
  /* ---------------------------------------------------------------- */

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

      const billingPeriod = body.billingPeriod ?? 'monthly'
      if (!VALID_BILLING_PERIODS.has(billingPeriod)) {
        return reply.status(400).send(apiError('billingPeriod must be "monthly" or "yearly"', ErrorCode.BAD_REQUEST))
      }

      const wallet = await getWalletFromRequest(request)
      if (!wallet) {
        return reply.status(401).send(apiError('Authentication required', ErrorCode.UNAUTHORIZED))
      }

      const existing = await getSubscription(tenantBillingKey(result.tenant), moduleId)
      if (!existing) {
        return reply.status(400).send(apiError('No active subscription to extend', ErrorCode.BAD_REQUEST))
      }

      const conditionsLookupId = result.tenant.id
      const conditions = await getConditions(moduleId, conditionsLookupId)
      const price = computePrice(moduleId, conditions, catalogEntry.pricing, {
        billingPeriod: billingPeriod as BillingPeriod,
      })

      const ext = calculateExtension(price, billingPeriod as BillingPeriod, existing)

      await expireStalePendingPayments().catch(() => {})

      const payment = await insertPaymentIntent({
        tenantSlug: tenantBillingKey(result.tenant),
        moduleId,
        paymentType: 'extend',
        amountUsdc: ext.amountUsdc,
        billingPeriod: billingPeriod as BillingPeriod,
        periodStart: ext.periodStart,
        periodEnd: ext.periodEnd,
        payerWallet: wallet,
        conditionsSnapshot: conditions,
        priceSnapshot: price,
      })

      return {
        noPaymentRequired: false,
        paymentId: payment.id,
        amountUsdc: payment.amountUsdc,
        memo: payment.memo,
        recipientWallet: BILLING_WALLET.toBase58(),
        recipientAta: BILLING_WALLET_ATA.toBase58(),
        billingPeriod,
        periodStart: ext.periodStart.toISOString(),
        periodEnd: ext.periodEnd.toISOString(),
      }
    },
  )
}
