import { getPool, query } from './client.js'
import { loadMarketplaceBySlug, type MarketplaceConfig } from '../config/marketplace-registry.js'

function rowToMarketplaceConfig(row: Record<string, unknown>): MarketplaceConfig {
  const parseJson = (val: unknown): unknown => (typeof val === 'string' ? JSON.parse(val) : val ?? null)
  const settings = parseJson(row.settings) as Record<string, unknown>
  return {
    tenantSlug: row.tenant_slug as string,
    tenantId: (row.tenant_id as string) ?? undefined,
    collectionMints: (settings.collectionMints as MarketplaceConfig['collectionMints']) ?? [],
    currencyMints: (settings.currencyMints as MarketplaceConfig['currencyMints']) ?? [],
    splAssetMints: (settings.splAssetMints as MarketplaceConfig['splAssetMints']) ?? [],
    whitelist: (settings.whitelist as MarketplaceConfig['whitelist']) ?? undefined,
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

/** Resolve marketplace config by tenant id: DB if available, else file. */
export async function resolveMarketplace(tenantId: string): Promise<MarketplaceConfig | null> {
  if (!getPool()) return loadMarketplaceBySlug(tenantId)
  try {
    const c = await getMarketplaceBySlug(tenantId)
    if (c) return c
  } catch {
    /* DB query failed */
  }
  return loadMarketplaceBySlug(tenantId)
}

export async function upsertMarketplace(slug: string, tenantId: string | undefined, settings: Omit<MarketplaceConfig, 'tenantSlug' | 'tenantId'>): Promise<void> {
  const payload = JSON.stringify({
    collectionMints: settings.collectionMints,
    currencyMints: settings.currencyMints,
    splAssetMints: settings.splAssetMints ?? [],
    whitelist: settings.whitelist,
    shopFee: settings.shopFee,
  })
  await query(
    `INSERT INTO marketplace_settings (tenant_slug, tenant_id, settings, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (tenant_slug) DO UPDATE SET
       tenant_id = COALESCE(EXCLUDED.tenant_id, marketplace_settings.tenant_id),
       settings = EXCLUDED.settings,
       updated_at = NOW()`,
    [slug, tenantId ?? null, payload]
  )
}
