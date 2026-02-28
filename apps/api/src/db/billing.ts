import { query, getPool } from './client.js'
import type { ConditionSet, PriceResult, BillingPeriod } from '@decentraguild/billing'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired'
export type PaymentType = 'initial' | 'upgrade_prorate' | 'renewal' | 'extend'

export interface BillingSubscription {
  id: string
  tenantSlug: string
  moduleId: string
  billingPeriod: BillingPeriod
  recurringAmountUsdc: number
  periodStart: Date
  periodEnd: Date
  conditionsSnapshot: ConditionSet
  priceSnapshot: PriceResult
  createdAt: Date
  updatedAt: Date
}

export interface BillingPayment {
  id: string
  tenantSlug: string
  moduleId: string
  paymentType: PaymentType
  amountUsdc: number
  billingPeriod: BillingPeriod
  periodStart: Date
  periodEnd: Date
  txSignature: string | null
  status: PaymentStatus
  memo: string
  payerWallet: string
  conditionsSnapshot: ConditionSet | null
  priceSnapshot: PriceResult | null
  createdAt: Date
  confirmedAt: Date | null
  expiresAt: Date
}

/* ------------------------------------------------------------------ */
/*  Row mapping                                                        */
/* ------------------------------------------------------------------ */

interface SubscriptionRow {
  id: string
  tenant_slug: string
  module_id: string
  billing_period: string
  recurring_amount_usdc: string
  period_start: Date
  period_end: Date
  conditions_snapshot: ConditionSet
  price_snapshot: PriceResult
  created_at: Date
  updated_at: Date
}

interface PaymentRow {
  id: string
  tenant_slug: string
  module_id: string
  payment_type: string
  amount_usdc: string
  billing_period: string
  period_start: Date
  period_end: Date
  tx_signature: string | null
  status: string
  memo: string
  payer_wallet: string
  conditions_snapshot: ConditionSet | null
  price_snapshot: PriceResult | null
  created_at: Date
  confirmed_at: Date | null
  expires_at: Date
}

function mapSubscription(row: SubscriptionRow): BillingSubscription {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    moduleId: row.module_id,
    billingPeriod: row.billing_period as BillingPeriod,
    recurringAmountUsdc: parseFloat(row.recurring_amount_usdc),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    conditionsSnapshot: row.conditions_snapshot,
    priceSnapshot: row.price_snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPayment(row: PaymentRow): BillingPayment {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    moduleId: row.module_id,
    paymentType: row.payment_type as PaymentType,
    amountUsdc: parseFloat(row.amount_usdc),
    billingPeriod: row.billing_period as BillingPeriod,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    txSignature: row.tx_signature,
    status: row.status as PaymentStatus,
    memo: row.memo,
    payerWallet: row.payer_wallet,
    conditionsSnapshot: row.conditions_snapshot,
    priceSnapshot: row.price_snapshot,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    expiresAt: row.expires_at,
  }
}

/* ------------------------------------------------------------------ */
/*  Subscriptions                                                      */
/* ------------------------------------------------------------------ */

export async function getSubscription(
  tenantSlug: string,
  moduleId: string,
): Promise<BillingSubscription | null> {
  const { rows } = await query<SubscriptionRow>(
    `SELECT * FROM billing_subscriptions WHERE tenant_slug = $1 AND module_id = $2`,
    [tenantSlug, moduleId],
  )
  return rows[0] ? mapSubscription(rows[0]) : null
}

export async function upsertSubscription(params: {
  tenantSlug: string
  moduleId: string
  billingPeriod: BillingPeriod
  recurringAmountUsdc: number
  periodStart: Date
  periodEnd: Date
  conditionsSnapshot: ConditionSet
  priceSnapshot: PriceResult
}): Promise<BillingSubscription> {
  const { rows } = await query<SubscriptionRow>(
    `INSERT INTO billing_subscriptions
       (tenant_slug, module_id, billing_period, recurring_amount_usdc,
        period_start, period_end, conditions_snapshot, price_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_slug, module_id) DO UPDATE SET
       billing_period = EXCLUDED.billing_period,
       recurring_amount_usdc = EXCLUDED.recurring_amount_usdc,
       period_start = EXCLUDED.period_start,
       period_end = EXCLUDED.period_end,
       conditions_snapshot = EXCLUDED.conditions_snapshot,
       price_snapshot = EXCLUDED.price_snapshot,
       updated_at = NOW()
     RETURNING *`,
    [
      params.tenantSlug,
      params.moduleId,
      params.billingPeriod,
      params.recurringAmountUsdc,
      params.periodStart,
      params.periodEnd,
      JSON.stringify(params.conditionsSnapshot),
      JSON.stringify(params.priceSnapshot),
    ],
  )
  return mapSubscription(rows[0])
}

/* ------------------------------------------------------------------ */
/*  Payments                                                           */
/* ------------------------------------------------------------------ */

const PAYMENT_INTENT_TTL_MS = 15 * 60 * 1000

export async function insertPaymentIntent(params: {
  tenantSlug: string
  moduleId: string
  paymentType: PaymentType
  amountUsdc: number
  billingPeriod: BillingPeriod
  periodStart: Date
  periodEnd: Date
  payerWallet: string
  conditionsSnapshot: ConditionSet
  priceSnapshot: PriceResult
}): Promise<BillingPayment> {
  const expiresAt = new Date(Date.now() + PAYMENT_INTENT_TTL_MS)
  const memo = `dg:pay:${crypto.randomUUID()}`
  const { rows } = await query<PaymentRow>(
    `INSERT INTO billing_payments
       (tenant_slug, module_id, payment_type, amount_usdc, billing_period,
        period_start, period_end, memo, payer_wallet, conditions_snapshot,
        price_snapshot, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      params.tenantSlug,
      params.moduleId,
      params.paymentType,
      params.amountUsdc,
      params.billingPeriod,
      params.periodStart,
      params.periodEnd,
      memo,
      params.payerWallet,
      JSON.stringify(params.conditionsSnapshot),
      JSON.stringify(params.priceSnapshot),
      expiresAt,
    ],
  )
  return mapPayment(rows[0])
}

export async function getPaymentById(
  paymentId: string,
): Promise<BillingPayment | null> {
  const { rows } = await query<PaymentRow>(
    `SELECT * FROM billing_payments WHERE id = $1`,
    [paymentId],
  )
  return rows[0] ? mapPayment(rows[0]) : null
}

export async function confirmPayment(
  paymentId: string,
  txSignature: string,
): Promise<BillingPayment> {
  const { rows } = await query<PaymentRow>(
    `UPDATE billing_payments
     SET status = 'confirmed', tx_signature = $2, confirmed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [paymentId, txSignature],
  )
  return mapPayment(rows[0])
}

export async function failPayment(
  paymentId: string,
): Promise<void> {
  await query(
    `UPDATE billing_payments SET status = 'failed' WHERE id = $1`,
    [paymentId],
  )
}

export async function expireStalePendingPayments(): Promise<number> {
  const { rowCount } = await query(
    `UPDATE billing_payments SET status = 'expired'
     WHERE status = 'pending' AND expires_at < NOW()`,
  )
  return rowCount
}

export async function listPayments(
  tenantSlug: string,
  opts?: { limit?: number; offset?: number },
): Promise<BillingPayment[]> {
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  const { rows } = await query<PaymentRow>(
    `SELECT * FROM billing_payments
     WHERE tenant_slug = $1 AND status = 'confirmed'
     ORDER BY confirmed_at DESC
     LIMIT $2 OFFSET $3`,
    [tenantSlug, limit, offset],
  )
  return rows.map(mapPayment)
}

/* ------------------------------------------------------------------ */
/*  Atomic confirm: payment + subscription + module state in one tx    */
/* ------------------------------------------------------------------ */

export async function confirmPaymentAndActivate(params: {
  paymentId: string
  txSignature: string
  tenantSlug: string
  moduleId: string
  billingPeriod: BillingPeriod
  recurringAmountUsdc: number
  periodStart: Date
  periodEnd: Date
  conditionsSnapshot: ConditionSet
  priceSnapshot: PriceResult
}): Promise<{ payment: BillingPayment; subscription: BillingSubscription }> {
  const pool = getPool()
  if (!pool) throw new Error('Database not initialized')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const payRes = await client.query(
      `UPDATE billing_payments
       SET status = 'confirmed', tx_signature = $2, confirmed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [params.paymentId, params.txSignature],
    )
    if (payRes.rows.length === 0) {
      throw new Error('Payment not found or already processed')
    }

    const subRes = await client.query(
      `INSERT INTO billing_subscriptions
         (tenant_slug, module_id, billing_period, recurring_amount_usdc,
          period_start, period_end, conditions_snapshot, price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_slug, module_id) DO UPDATE SET
         billing_period = EXCLUDED.billing_period,
         recurring_amount_usdc = EXCLUDED.recurring_amount_usdc,
         period_start = EXCLUDED.period_start,
         period_end = EXCLUDED.period_end,
         conditions_snapshot = EXCLUDED.conditions_snapshot,
         price_snapshot = EXCLUDED.price_snapshot,
         updated_at = NOW()
       RETURNING *`,
      [
        params.tenantSlug,
        params.moduleId,
        params.billingPeriod,
        params.recurringAmountUsdc,
        params.periodStart,
        params.periodEnd,
        JSON.stringify(params.conditionsSnapshot),
        JSON.stringify(params.priceSnapshot),
      ],
    )

    await client.query(
      `UPDATE tenant_config
       SET modules = jsonb_set(
         COALESCE(modules, '{}'::jsonb),
         ARRAY[$1],
         jsonb_build_object(
           'state', 'active',
           'deactivatedate', $2::text,
           'deactivatingUntil', null,
           'settingsjson', COALESCE(modules -> $1 -> 'settingsjson', '{}'::jsonb)
         )
       ),
       updated_at = NOW()
       WHERE slug = $3 OR id = $3`,
      [params.moduleId, params.periodEnd.toISOString(), params.tenantSlug],
    )

    await client.query('COMMIT')

    return {
      payment: mapPayment(payRes.rows[0] as PaymentRow),
      subscription: mapSubscription(subRes.rows[0] as SubscriptionRow),
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Same as confirmPaymentAndActivate but for slug claim: updates tenant slug instead of modules. */
export async function confirmSlugClaimPayment(params: {
  paymentId: string
  txSignature: string
  tenantId: string
  newSlug: string
  billingPeriod: BillingPeriod
  recurringAmountUsdc: number
  periodStart: Date
  periodEnd: Date
  conditionsSnapshot: ConditionSet
  priceSnapshot: PriceResult
}): Promise<{ payment: BillingPayment; subscription: BillingSubscription }> {
  const pool = getPool()
  if (!pool) throw new Error('Database not initialized')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const payRes = await client.query(
      `UPDATE billing_payments
       SET status = 'confirmed', tx_signature = $2, confirmed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [params.paymentId, params.txSignature],
    )
    if (payRes.rows.length === 0) {
      throw new Error('Payment not found or already processed')
    }

    await client.query(
      `UPDATE tenant_config SET slug = $1, updated_at = NOW() WHERE id = $2`,
      [params.newSlug, params.tenantId],
    )

    const subRes = await client.query(
      `INSERT INTO billing_subscriptions
         (tenant_slug, module_id, billing_period, recurring_amount_usdc,
          period_start, period_end, conditions_snapshot, price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_slug, module_id) DO UPDATE SET
         billing_period = EXCLUDED.billing_period,
         recurring_amount_usdc = EXCLUDED.recurring_amount_usdc,
         period_start = EXCLUDED.period_start,
         period_end = EXCLUDED.period_end,
         conditions_snapshot = EXCLUDED.conditions_snapshot,
         price_snapshot = EXCLUDED.price_snapshot,
         updated_at = NOW()
       RETURNING *`,
      [
        params.tenantId,
        'slug',
        params.billingPeriod,
        params.recurringAmountUsdc,
        params.periodStart,
        params.periodEnd,
        JSON.stringify(params.conditionsSnapshot),
        JSON.stringify(params.priceSnapshot),
      ],
    )

    await client.query('COMMIT')

    return {
      payment: mapPayment(payRes.rows[0] as PaymentRow),
      subscription: mapSubscription(subRes.rows[0] as SubscriptionRow),
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
