/**
 * Billing service: high-level operations for price preview, payment intents,
 * confirmation, and subscription extension. Used by billing routes so handlers
 * stay thin (validate, auth, call service, respond).
 */

import type { BillingPeriod, ConditionSet, PriceResult } from '@decentraguild/billing'
import { computePrice, getOneTimePerUnitForTier } from '@decentraguild/billing'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { getConditions } from './conditions.js'
import { calculateCharge, calculateExtension } from './prorate.js'
import {
  getSubscription,
  insertPaymentIntent,
  getPaymentById,
  confirmPaymentOnly,
  confirmPaymentAndActivate,
  confirmSlugClaimPayment,
  failPayment,
  expireStalePendingPayments,
} from '../db/billing.js'
import type { BillingSubscription } from '../db/billing.js'
import { resolveTenant } from '../db/tenant.js'
import { normalizeTenantSlug } from '../validate-slug.js'
import { getTenantBySlug } from '../db/tenant.js'
import { loadTenantByIdOrSlug } from '../config/registry.js'

export interface TenantForBilling {
  id: string
  slug?: string | null
}

export interface PreviewPriceParams {
  tenantId: string
  moduleId: string
  billingPeriod?: BillingPeriod
  conditions?: ConditionSet
}

export interface PreviewPriceResult {
  conditions: ConditionSet
  price: PriceResult
}

/** Get conditions and computed price for a module (no I/O beyond conditions). */
export async function previewPrice(params: PreviewPriceParams): Promise<PreviewPriceResult> {
  const { tenantId, moduleId, billingPeriod = 'monthly', conditions: overrideConditions } = params
  const catalogEntry = getModuleCatalogEntry(moduleId)
  if (!catalogEntry?.pricing) {
    throw new Error('Module not found or not billable')
  }
  const conditions: ConditionSet =
    overrideConditions && typeof overrideConditions === 'object'
      ? overrideConditions
      : await getConditions(moduleId, tenantId)
  const price = computePrice(moduleId, conditions, catalogEntry.pricing, {
    billingPeriod,
  })
  return { conditions, price }
}

export interface CreatePaymentIntentParams {
  tenant: TenantForBilling
  moduleId: string
  billingPeriod?: BillingPeriod
  conditions?: ConditionSet
  slug?: string
  payerWallet: string
}

export interface PaymentIntentResponse {
  noPaymentRequired: true
  amountUsdc: number
  billingPeriod: string
  periodStart: string
  periodEnd: string
}

export interface PaymentIntentCreatedResponse {
  noPaymentRequired: false
  paymentId: string
  amountUsdc: number
  memo: string
  recipientWallet: string
  recipientAta: string
  billingPeriod: string
  periodStart: string
  periodEnd: string
}

export type CreatePaymentIntentResult = PaymentIntentResponse | PaymentIntentCreatedResponse

/**
 * Create a payment intent for initial, upgrade_prorate, add_unit, or slug claim.
 * Validates module/slug; computes price and charge; inserts payment record.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<CreatePaymentIntentResult> {
  const { tenant, moduleId, payerWallet } = params
  const catalogEntry = getModuleCatalogEntry(moduleId)
  if (!catalogEntry?.pricing) {
    throw new Error('Module not found or not billable')
  }

  let billingPeriod: BillingPeriod = (params.billingPeriod ?? 'monthly') as BillingPeriod
  if (moduleId === 'slug') {
    billingPeriod = 'yearly'
    const desiredSlug = params.slug
    if (!desiredSlug || typeof desiredSlug !== 'string') {
      throw new Error('slug is required when claiming custom slug')
    }
    const normalized = normalizeTenantSlug(desiredSlug.trim())
    if (!normalized) {
      throw new Error('Invalid slug: use only lowercase letters, numbers, and hyphens (1–64 chars)')
    }
    if (tenant.slug) {
      throw new Error('Tenant already has a custom slug')
    }
    const existingDb = await getTenantBySlug(normalized)
    const existingFile = await loadTenantByIdOrSlug(normalized)
    if (existingDb || existingFile) {
      throw new Error('Slug is not available')
    }
  }

  const billingKey = tenant.id
  const conditions: ConditionSet =
    params.conditions && typeof params.conditions === 'object'
      ? params.conditions
      : await getConditions(moduleId, tenant.id)
  if (moduleId === 'slug' && params.slug) {
    const desiredSlug = normalizeTenantSlug(params.slug.trim())
    if (desiredSlug) (conditions as Record<string, unknown>).slugToClaim = desiredSlug
  }

  const price = computePrice(moduleId, conditions, catalogEntry.pricing, {
    billingPeriod,
  })

  await expireStalePendingPayments().catch(() => {})

  const existing = await getSubscription(billingKey, moduleId)
  const charge = calculateCharge(price, billingPeriod, existing)

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
    billingPeriod,
    periodStart: charge.periodStart,
    periodEnd: charge.periodEnd,
    payerWallet,
    conditionsSnapshot: conditions,
    priceSnapshot: enrichedSnapshot as unknown as PriceResult,
  })

  const { BILLING_WALLET, BILLING_WALLET_ATA } = await import('./verify-payment.js')
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
}

export interface ConfirmPaymentParams {
  tenant: TenantForBilling
  paymentId: string
  txSignature: string
}

export interface ConfirmPaymentResult {
  success: true
  alreadyConfirmed?: boolean
  subscription: BillingSubscription | null
  tenant: Awaited<ReturnType<typeof resolveTenant>>
}

/**
 * Confirm a payment after on-chain verification. Dispatches to the appropriate
 * DB confirm (add_unit: confirmPaymentOnly; slug: confirmSlugClaimPayment; else confirmPaymentAndActivate).
 * Caller must verify the transaction before calling this.
 */
export async function confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult> {
  const { tenant, paymentId, txSignature } = params
  const billingKey = tenant.id
  const payment = await getPaymentById(paymentId)
  if (!payment) {
    throw new Error('Payment not found')
  }
  if (payment.tenantSlug !== billingKey) {
    throw new Error('Payment does not belong to this tenant')
  }
  if (payment.status === 'confirmed') {
    const tenantRes = await resolveTenant(tenant.id)
    return { success: true, alreadyConfirmed: true, subscription: null, tenant: tenantRes }
  }
  if (payment.status !== 'pending') {
    throw new Error(`Payment is ${payment.status}`)
  }
  if (payment.expiresAt < new Date()) {
    await failPayment(paymentId)
    throw new Error('Payment intent has expired')
  }

  const conditions = payment.conditionsSnapshot ?? {}
  const priceSnapshot = payment.priceSnapshot ?? ({} as PriceResult)
  const recurringAmountUsdc = payment.priceSnapshot
    ? payment.billingPeriod === 'yearly'
      ? payment.priceSnapshot.recurringYearly
      : payment.priceSnapshot.recurringMonthly
    : payment.amountUsdc

  let subscription: BillingSubscription | null = null
  let tenantRes = await resolveTenant(tenant.id)

  if (payment.moduleId === 'slug') {
    const slugToClaim = (conditions as Record<string, unknown>).slugToClaim
    if (typeof slugToClaim !== 'string' || !slugToClaim) {
      await failPayment(paymentId)
      throw new Error('Slug claim payment missing slug')
    }
    const result = await confirmSlugClaimPayment({
      paymentId,
      txSignature,
      tenantId: tenant.id,
      newSlug: slugToClaim,
      billingPeriod: payment.billingPeriod,
      recurringAmountUsdc,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      conditionsSnapshot: conditions,
      priceSnapshot,
    })
    subscription = result.subscription
    const updated = await resolveTenant(slugToClaim)
    tenantRes = updated ?? tenantRes
  } else if (payment.paymentType === 'add_unit') {
    await confirmPaymentOnly({ paymentId, txSignature })
  } else {
    const result = await confirmPaymentAndActivate({
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
    subscription = result.subscription
  }

  return { success: true, subscription, tenant: tenantRes }
}

export interface ExtendSubscriptionParams {
  tenant: TenantForBilling
  moduleId: string
  billingPeriod: BillingPeriod
  payerWallet: string
}

/**
 * Create a payment intent to extend an existing subscription by one period.
 */
export async function extendSubscription(
  params: ExtendSubscriptionParams,
): Promise<PaymentIntentCreatedResponse> {
  const { tenant, moduleId, billingPeriod, payerWallet } = params
  const catalogEntry = getModuleCatalogEntry(moduleId)
  if (!catalogEntry?.pricing) {
    throw new Error('Module not found or not billable')
  }

  const billingKey = tenant.id
  const existing = await getSubscription(billingKey, moduleId)
  if (!existing) {
    throw new Error('No active subscription to extend')
  }

  const conditions = await getConditions(moduleId, tenant.id)
  const price = computePrice(moduleId, conditions, catalogEntry.pricing, {
    billingPeriod,
  })
  const ext = calculateExtension(price, billingPeriod, existing)

  await expireStalePendingPayments().catch(() => {})

  const payment = await insertPaymentIntent({
    tenantSlug: billingKey,
    moduleId,
    paymentType: 'extend',
    amountUsdc: ext.amountUsdc,
    billingPeriod,
    periodStart: ext.periodStart,
    periodEnd: ext.periodEnd,
    payerWallet,
    conditionsSnapshot: conditions,
    priceSnapshot: price,
  })

  const { BILLING_WALLET, BILLING_WALLET_ATA } = await import('./verify-payment.js')
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
}

/** Billing key for a tenant (id, not slug). */
export function tenantBillingKey(tenant: TenantForBilling): string {
  return tenant.id
}

export interface CreateRafflePaymentIntentParams {
  tenant: TenantForBilling
  payerWallet: string
}

export type CreateRafflePaymentIntentResult =
  | { noPaymentRequired: true }
  | PaymentIntentCreatedResponse

/**
 * Create a payment intent for the one-time "per raffle" fee when creating a new raffle.
 * Uses getOneTimePerUnitForTier from subscription; if no subscription, treats as base tier.
 * Returns noPaymentRequired if amount is 0 (Grow/Pro).
 */
export async function createRafflePaymentIntent(
  params: CreateRafflePaymentIntentParams,
): Promise<CreateRafflePaymentIntentResult> {
  const { tenant, payerWallet } = params
  const catalogEntry = getModuleCatalogEntry('raffles')
  const pricing = catalogEntry?.pricing
  if (!pricing || pricing.modelType !== 'tiered_with_one_time_per_unit') {
    throw new Error('Raffle module pricing not configured')
  }

  const billingKey = tenant.id
  const conditions = await getConditions('raffles', billingKey)
  const price = computePrice('raffles', conditions, pricing, { billingPeriod: 'monthly' })

  const subscription = await getSubscription(billingKey, 'raffles')
  const { getModuleBillingState } = await import('../db/module-billing-state.js')
  const fallbackState = !subscription ? await getModuleBillingState(billingKey, 'raffles') : null
  const selectedTierId =
    subscription?.priceSnapshot?.selectedTierId ??
    fallbackState?.selectedTierId ??
    price.selectedTierId ??
    'base'
  const oneTimeAmount = getOneTimePerUnitForTier(pricing, selectedTierId)

  if (oneTimeAmount <= 0) {
    return { noPaymentRequired: true }
  }

  await expireStalePendingPayments().catch(() => {})

  const enrichedSnapshot: Record<string, unknown> = { ...price, oneTimePerUnitForSelectedTier: oneTimeAmount }
  const payment = await insertPaymentIntent({
    tenantSlug: billingKey,
    moduleId: 'raffles',
    paymentType: 'add_unit',
    amountUsdc: oneTimeAmount,
    billingPeriod: 'monthly',
    periodStart: new Date(),
    periodEnd: new Date(),
    payerWallet,
    conditionsSnapshot: conditions,
    priceSnapshot: enrichedSnapshot as unknown as PriceResult,
  })

  const { BILLING_WALLET, BILLING_WALLET_ATA } = await import('./verify-payment.js')
  return {
    noPaymentRequired: false,
    paymentId: payment.id,
    amountUsdc: payment.amountUsdc,
    memo: payment.memo,
    recipientWallet: BILLING_WALLET.toBase58(),
    recipientAta: BILLING_WALLET_ATA.toBase58(),
    billingPeriod: 'monthly',
    periodStart: payment.periodStart.toISOString(),
    periodEnd: payment.periodEnd.toISOString(),
  }
}
