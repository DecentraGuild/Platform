import { getPool, query } from './client.js'
import { loadMarketplaceBySlug, type MarketplaceConfig } from '../config/marketplace-registry.js'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function rowToMarketplaceConfig(row: Record<string, unknown>): MarketplaceConfig {
  const parseJson = (val: unknown): unknown => (typeof val === 'string' ? JSON.parse(val) : val ?? null)
  const settings = parseJson(row.settings) as Record<string, unknown>
  return {
    tenantSlug: row.tenant_slug as string,
    tenantId: (row.tenant_id as string) ?? undefined,
    collectionMints: (settings.collectionMints as MarketplaceConfig['collectionMints']) ?? [],
    currencyMints: (settings.currencyMints as MarketplaceConfig['currencyMints']) ?? [],
    splAssetMints: (settings.splAssetMints as MarketplaceConfig['splAssetMints']) ?? [],
    whitelist: Object.prototype.hasOwnProperty.call(settings, 'whitelist') ? (settings.whitelist as MarketplaceConfig['whitelist']) : undefined,
    shopFee: (settings.shopFee as MarketplaceConfig['shopFee']) ?? {
      wallet: '',
      makerFlatFee: 0,
      takerFlatFee: 0,
      makerPercentFee: 0,
      takerPercentFee: 0,
    },
  }
}

export async function getMarketplaceBySlug(slug: string): Promise<MarketplaceConfig | null> {
  const { rows } = await query<Record<string, unknown>>(
    'SELECT tenant_slug, tenant_id, settings FROM marketplace_settings WHERE tenant_slug = $1',
    [slug]
  )
  if (rows.length === 0) return null
  return rowToMarketplaceConfig(rows[0])
}

/** Get marketplace config by canonical tenant id. Preferred over slug for ops and subscription. */
export async function getMarketplaceByTenantId(tenantId: string): Promise<MarketplaceConfig | null> {
  const { rows } = await query<Record<string, unknown>>(
    'SELECT tenant_slug, tenant_id, settings FROM marketplace_settings WHERE tenant_id = $1',
    [tenantId]
  )
  if (rows.length === 0) return null
  return rowToMarketplaceConfig(rows[0])
}

/** Resolve marketplace config by tenant id (canonical). Tries tenant_id first, then tenant_slug for legacy rows.
 * Production: DB only (no file fallback).
 * Local (non-production): DB if available, else file.
 */
export async function resolveMarketplace(tenantId: string): Promise<MarketplaceConfig | null> {
  const pool = getPool()
  if (!pool) {
    if (isProduction()) return null
    return loadMarketplaceBySlug(tenantId)
  }

  try {
    const byId = await getMarketplaceByTenantId(tenantId)
    if (byId) return byId
    const bySlug = await getMarketplaceBySlug(tenantId)
    if (bySlug) return bySlug
  } catch {
    if (isProduction()) return null
  }

  if (isProduction()) return null
  return loadMarketplaceBySlug(tenantId)
}

/** Upsert marketplace settings. Uses tenant_id as canonical key: updates existing row by tenant_id, else inserts.
 * Ensures one row per tenant (no duplicate when row was keyed by slug). */
export async function upsertMarketplace(tenantId: string, settings: Omit<MarketplaceConfig, 'tenantSlug' | 'tenantId'>): Promise<void> {
  const payload = JSON.stringify({
    collectionMints: settings.collectionMints,
    currencyMints: settings.currencyMints,
    splAssetMints: settings.splAssetMints ?? [],
    whitelist: settings.whitelist,
    shopFee: settings.shopFee,
  })
  const { rowCount } = await query(
    `UPDATE marketplace_settings SET tenant_slug = $1, settings = $2::jsonb, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, payload]
  )
  if ((rowCount ?? 0) > 0) return
  await query(
    `INSERT INTO marketplace_settings (tenant_slug, tenant_id, settings, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (tenant_slug) DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       settings = EXCLUDED.settings,
       updated_at = NOW()`,
    [tenantId, tenantId, payload]
  )
}
