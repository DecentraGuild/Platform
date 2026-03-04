/**
 * Per-tenant, per-module billing state: selected tier and period end.
 * Persisted so we can recover if billing_subscriptions data is lost.
 * Written on every payment confirm (initial, upgrade, extend) for tiered modules.
 */

import type { PoolClient } from 'pg'
import { query, getPool } from './client.js'

export interface ModuleBillingState {
  selectedTierId: string | null
  periodEnd: Date | null
  updatedAt: Date
}

interface Row {
  selected_tier_id: string | null
  period_end: Date | null
  updated_at: Date
}

/** Get stored billing state for a tenant/module (for recovery when subscription is missing). */
export async function getModuleBillingState(
  tenantSlug: string,
  moduleId: string,
): Promise<ModuleBillingState | null> {
  const { rows } = await query<Row>(
    `SELECT selected_tier_id, period_end, updated_at
     FROM tenant_module_billing_state
     WHERE tenant_slug = $1 AND module_id = $2`,
    [tenantSlug, moduleId],
  )
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    selectedTierId: r.selected_tier_id,
    periodEnd: r.period_end,
    updatedAt: r.updated_at,
  }
}

/** Upsert billing state. Use from within a transaction (pass client) or standalone. */
export async function upsertModuleBillingState(
  tenantSlug: string,
  moduleId: string,
  data: { selectedTierId?: string | null; periodEnd?: Date | null },
  client?: PoolClient,
): Promise<void> {
  const selectedTierId = data.selectedTierId ?? null
  const periodEnd = data.periodEnd ?? null
  const sql = `INSERT INTO tenant_module_billing_state (tenant_slug, module_id, selected_tier_id, period_end, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_slug, module_id) DO UPDATE SET
       selected_tier_id = EXCLUDED.selected_tier_id,
       period_end = EXCLUDED.period_end,
       updated_at = NOW()`
  const params = [tenantSlug, moduleId, selectedTierId, periodEnd]
  if (client) {
    await client.query(sql, params)
    return
  }
  const pool = getPool()
  if (!pool) return
  await pool.query(sql, params)
}
