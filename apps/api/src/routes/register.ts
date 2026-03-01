import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { type TenantConfig, normalizeModules } from '@decentraguild/core'
import type { ConditionSet } from '@decentraguild/billing'
import { computePrice } from '@decentraguild/billing'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { getWalletFromRequest } from './auth.js'
import { getTenantById } from '../db/tenant.js'
import { loadTenantByIdOrSlug } from '../config/registry.js'
import { tenantCreateRateLimit } from '../rate-limit-strict.js'
import { apiError, ErrorCode } from '../api-errors.js'
import { getPool } from '../db/client.js'
import {
  insertPaymentIntent,
  getPaymentById,
  confirmPayment,
  failPayment,
  expireStalePendingPayments,
} from '../db/billing.js'
import { upsertTenant } from '../db/tenant.js'
import { verifyBillingPayment, BILLING_WALLET, BILLING_WALLET_ATA } from '../billing/verify-payment.js'

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateTenantId(): string {
  const bytes = randomBytes(8)
  return 'dg_' + Array.from(bytes).map((b) => ALPHANUM[b % ALPHANUM.length]).join('')
}

export async function registerRegisterRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      name: string
      description?: string
      branding?: Record<string, unknown>
      discordInviteLink?: string
    }
  }>(
    '/api/v1/register/intent',
    { preHandler: [tenantCreateRateLimit] },
    async (request, reply) => {
      const wallet = await getWalletFromRequest(request)
      if (!wallet) {
        return reply.status(401).send(apiError('Authentication required', ErrorCode.UNAUTHORIZED))
      }
      if (!getPool()) {
        return reply.status(503).send(apiError('Database not configured', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const body = request.body ?? {}
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const description = typeof body.description === 'string' ? body.description.trim() : ''
      const branding = body.branding && typeof body.branding === 'object' ? (body.branding as Record<string, unknown>) : {}
      const logo = typeof branding.logo === 'string' ? branding.logo.trim() : ''
      if (!name) {
        return reply.status(400).send(apiError('name is required', ErrorCode.BAD_REQUEST))
      }
      if (!description) {
        return reply.status(400).send(apiError('description is required', ErrorCode.BAD_REQUEST))
      }
      if (!logo) {
        return reply.status(400).send(apiError('logo is required', ErrorCode.BAD_REQUEST))
      }

      const catalogEntry = getModuleCatalogEntry('admin')
      if (!catalogEntry?.pricing) {
        return reply.status(503).send(apiError('Admin registration pricing not configured', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const price = computePrice('admin', {}, catalogEntry.pricing, { billingPeriod: 'yearly' })
      const amountUsdc = price.oneTimeTotal
      if (amountUsdc <= 0) {
        return reply.status(503).send(apiError('Registration fee must be greater than zero', ErrorCode.SERVICE_UNAVAILABLE))
      }

      let tenantId = ''
      for (let attempts = 0; attempts < 20; attempts++) {
        const candidate = generateTenantId()
        const existingDb = await getTenantById(candidate)
        const existingFile = await loadTenantByIdOrSlug(candidate)
        if (!existingDb && !existingFile) {
          tenantId = candidate
          break
        }
      }
      if (!tenantId) tenantId = generateTenantId()

      await expireStalePendingPayments().catch(() => {})

      const now = new Date()
      const payment = await insertPaymentIntent({
        tenantSlug: tenantId,
        moduleId: 'admin',
        paymentType: 'registration',
        amountUsdc,
        billingPeriod: 'yearly',
        periodStart: now,
        periodEnd: now,
        payerWallet: wallet,
        conditionsSnapshot: {
          registrationForm: {
            name,
            description,
            branding: body.branding && typeof body.branding === 'object' ? body.branding : undefined,
            discordInviteLink: typeof body.discordInviteLink === 'string' ? body.discordInviteLink.trim() || undefined : undefined,
          },
        } as unknown as ConditionSet,
        priceSnapshot: price,
      })

      return {
        paymentId: payment.id,
        amountUsdc: payment.amountUsdc,
        memo: payment.memo,
        recipientWallet: BILLING_WALLET.toBase58(),
        recipientAta: BILLING_WALLET_ATA.toBase58(),
        tenantId,
      }
    },
  )

  app.post<{
    Body: { paymentId: string; txSignature: string }
  }>(
    '/api/v1/register/confirm',
    { preHandler: [tenantCreateRateLimit] },
    async (request, reply) => {
      const wallet = await getWalletFromRequest(request)
      if (!wallet) {
        return reply.status(401).send(apiError('Authentication required', ErrorCode.UNAUTHORIZED))
      }
      if (!getPool()) {
        return reply.status(503).send(apiError('Database not configured', ErrorCode.SERVICE_UNAVAILABLE))
      }

      const body = request.body ?? {}
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
      if (payment.moduleId !== 'admin' || payment.paymentType !== 'registration') {
        return reply.status(400).send(apiError('Invalid payment type', ErrorCode.BAD_REQUEST))
      }
      if (payment.payerWallet !== wallet) {
        return reply.status(403).send(apiError('Payment does not belong to this wallet', ErrorCode.FORBIDDEN))
      }

      if (payment.status === 'confirmed') {
        const tenant = await getTenantById(payment.tenantSlug)
        if (tenant) {
          return { success: true, alreadyConfirmed: true, tenant }
        }
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
          apiError(verification.error ?? 'Transaction verification failed', ErrorCode.BAD_REQUEST),
        )
      }

      const conditions = payment.conditionsSnapshot ?? {}
      const form = (conditions as Record<string, unknown>).registrationForm
      if (!form || typeof form !== 'object') {
        await failPayment(paymentId)
        return reply.status(400).send(apiError('Registration form data missing', ErrorCode.BAD_REQUEST))
      }

      const formObj = form as Record<string, unknown>
      const name = typeof formObj.name === 'string' ? formObj.name.trim() : ''
      if (!name) {
        await failPayment(paymentId)
        return reply.status(400).send(apiError('Registration form invalid', ErrorCode.BAD_REQUEST))
      }

      await confirmPayment(paymentId, txSignature)

      const baseBranding = formObj.branding && typeof formObj.branding === 'object' ? (formObj.branding as Record<string, unknown>) : {}
      const discordLink = (formObj.discordInviteLink as string) ?? (baseBranding.discordServerInviteLink as string)
      delete (baseBranding as Record<string, unknown>).discordServerInviteLink
      const config: TenantConfig = {
        id: payment.tenantSlug,
        slug: undefined,
        name,
        description: typeof formObj.description === 'string' ? formObj.description.trim() : undefined,
        discordServerInviteLink: typeof discordLink === 'string' && discordLink.trim() ? discordLink.trim() : undefined,
        branding: baseBranding,
        modules: normalizeModules([{ id: 'admin', enabled: true }]),
        admins: [wallet],
      }
      await upsertTenant(config)

      const tenant = await getTenantById(payment.tenantSlug)
      return { success: true, tenant }
    },
  )
}
