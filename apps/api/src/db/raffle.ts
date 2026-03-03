import { query, getPool } from './client.js'

export interface TenantRaffleRow {
  id: string
  tenant_slug: string
  raffle_pubkey: string
  created_at: Date
  closed_at: Date | null
}

export interface RaffleSettings {
  defaultWhitelist?: { programId: string; account: string } | 'use-default' | null
}

function mapRaffleRow(row: Record<string, unknown>): TenantRaffleRow {
  return {
    id: row.id as string,
    tenant_slug: row.tenant_slug as string,
    raffle_pubkey: row.raffle_pubkey as string,
    created_at: row.created_at as Date,
    closed_at: (row.closed_at as Date) ?? null,
  }
}

/** Count active (non-closed) raffles for a tenant. Used by billing extractor. */
export async function countActiveRaffles(tenantSlug: string): Promise<number> {
  const { rows } = await query<Record<string, unknown>>(
    `SELECT COUNT(*)::int AS count FROM tenant_raffles
     WHERE tenant_slug = $1 AND closed_at IS NULL`,
    [tenantSlug],
  )
  return (rows[0]?.count as number) ?? 0
}

/** Register a raffle after successful initialize tx. */
export async function registerRaffle(tenantSlug: string, rafflePubkey: string): Promise<TenantRaffleRow> {
  const { rows } = await query<Record<string, unknown>>(
    `INSERT INTO tenant_raffles (tenant_slug, raffle_pubkey)
     VALUES ($1, $2)
     ON CONFLICT (tenant_slug, raffle_pubkey) DO UPDATE SET closed_at = NULL
     RETURNING *`,
    [tenantSlug, rafflePubkey],
  )
  return mapRaffleRow(rows[0])
}

/** Mark raffle as closed after successful close tx. */
export async function closeRaffle(tenantSlug: string, rafflePubkey: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE tenant_raffles SET closed_at = NOW() WHERE tenant_slug = $1 AND raffle_pubkey = $2 AND closed_at IS NULL`,
    [tenantSlug, rafflePubkey],
  )
  return (rowCount ?? 0) > 0
}

/** List raffles for a tenant (all, including closed). */
export async function listRaffles(tenantSlug: string): Promise<TenantRaffleRow[]> {
  const { rows } = await query<Record<string, unknown>>(
    `SELECT * FROM tenant_raffles WHERE tenant_slug = $1 ORDER BY created_at DESC`,
    [tenantSlug],
  )
  return rows.map(mapRaffleRow)
}

/** Get raffle settings for a tenant. */
export async function getRaffleSettings(tenantSlug: string): Promise<RaffleSettings | null> {
  const pool = getPool()
  if (!pool) return null
  const { rows } = await query<Record<string, unknown>>(
    `SELECT settings FROM raffle_settings WHERE tenant_slug = $1`,
    [tenantSlug],
  )
  if (rows.length === 0) return null
  const settings = rows[0].settings
  if (typeof settings === 'string') return JSON.parse(settings) as RaffleSettings
  return (settings ?? {}) as RaffleSettings
}

/** Upsert raffle settings. */
export async function upsertRaffleSettings(
  tenantSlug: string,
  tenantId: string | undefined,
  settings: RaffleSettings,
): Promise<void> {
  const payload = JSON.stringify(settings)
  await query(
    `INSERT INTO raffle_settings (tenant_slug, tenant_id, settings, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (tenant_slug) DO UPDATE SET
       tenant_id = COALESCE(EXCLUDED.tenant_id, raffle_settings.tenant_id),
       settings = EXCLUDED.settings,
       updated_at = NOW()`,
    [tenantSlug, tenantId ?? null, payload],
  )
}
