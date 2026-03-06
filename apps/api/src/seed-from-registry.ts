/**
 * Seed tenants and marketplace configs from file registry into DB.
 * Used only by the standalone script: pnpm run seed:tenants.
 * The API does not run this on startup; DB is source of truth when DATABASE_URL is set.
 */

import { listTenantSlugs, loadTenantByIdOrSlug } from './config/registry.js'
import { loadMarketplaceBySlug, listMarketplaceSlugs } from './config/marketplace-registry.js'
import { upsertTenant } from './db/tenant.js'
import { upsertMarketplace } from './db/marketplace-settings.js'
import { upsertMintMetadata } from './db/marketplace-metadata.js'
import { expandAndSaveScope } from './marketplace/expand-collections.js'
import type { MarketplaceConfig } from './config/marketplace-registry.js'

/** Known decimals for common currency mints (seed fallback) */
const KNOWN_DECIMALS: Record<string, number> = {
  So11111111111111111111111111111111111111112: 9,
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 8,
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6,
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 6,
  ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx: 8,
  poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk: 6,
}

export interface SeedLog {
  warn: (obj: unknown, msg?: string) => void
}

export async function seedMintMetadataFromConfig(
  config: MarketplaceConfig,
  log?: SeedLog
): Promise<void> {
  const onUpsertFail = (err: unknown, mint: string) => {
    if (log) log.warn({ err, mint }, 'Mint metadata upsert skipped')
  }
  for (const { mint, name, image, sellerFeeBasisPoints } of config.collectionMints) {
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), {
      name: name ?? null,
      symbol: null,
      image: image ?? null,
      sellerFeeBasisPoints: sellerFeeBasisPoints ?? null,
    }).catch((e) => onUpsertFail(e, mint.trim()))
  }
  for (const c of config.currencyMints) {
    const { mint, name, symbol, image, decimals, sellerFeeBasisPoints } = c
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), {
      name: name ?? null,
      symbol: symbol ?? null,
      image: image ?? null,
      decimals: decimals ?? KNOWN_DECIMALS[mint] ?? null,
      sellerFeeBasisPoints: sellerFeeBasisPoints ?? null,
    }).catch((e) => onUpsertFail(e, mint.trim()))
  }
  for (const s of config.splAssetMints ?? []) {
    const { mint, name, symbol, image, decimals, sellerFeeBasisPoints } = s
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), {
      name: name ?? null,
      symbol: symbol ?? null,
      image: image ?? null,
      decimals: decimals ?? null,
      sellerFeeBasisPoints: sellerFeeBasisPoints ?? null,
    }).catch((e) => onUpsertFail(e, mint.trim()))
  }
}

/**
 * Load all tenants and marketplace configs from the file registry and upsert into DB.
 * Run explicitly via pnpm run seed:tenants when you want to push dev config into the DB
 * (e.g. before deploy). The API never runs this automatically.
 */
export async function runSeedFromRegistry(log: SeedLog): Promise<void> {
  const tenantIds = await listTenantSlugs()
  for (const idOrSlug of tenantIds) {
    const tenant = await loadTenantByIdOrSlug(idOrSlug)
    if (tenant) await upsertTenant(tenant)
  }
  const marketplaceIds = await listMarketplaceSlugs()
  for (const idOrSlug of marketplaceIds) {
    const config = await loadMarketplaceBySlug(idOrSlug)
    if (!config) continue
    const tenant = await loadTenantByIdOrSlug(idOrSlug)
    if (tenant) await upsertTenant(tenant)
    const tenantId = tenant?.id ?? config.tenantId ?? idOrSlug
    await upsertMarketplace(tenantId, {
      collectionMints: config.collectionMints,
      currencyMints: config.currencyMints,
      splAssetMints: config.splAssetMints ?? [],
      whitelist: config.whitelist,
      shopFee: config.shopFee,
    })
    try {
      await seedMintMetadataFromConfig(config, log)
    } catch (e) {
      log.warn({ err: e, tenantId }, 'Mint metadata seed failed')
    }
    try {
      await expandAndSaveScope(tenantId, config, log)
    } catch (e) {
      log.warn({ err: e, tenantId }, 'Scope expansion failed during seed')
    }
  }
}
