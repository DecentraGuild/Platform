/**
 * Enrich marketplace config with mint metadata from the API mint list (mint_metadata).
 * When config has only mint (or missing fields), we fill name, symbol, decimals, image,
 * sellerFeeBasisPoints from the DB so tenant JSON can stay minimal and we resolve by mint.
 */

import { getPool } from '../db/client.js'
import { getMintMetadataBatch } from '../db/marketplace-metadata.js'
import { resolveMarketplace } from '../db/marketplace-settings.js'
import type { MarketplaceConfig } from '../config/marketplace-registry.js'
import type { MintMetadata } from '../db/marketplace-metadata.js'

function mergeCurrencyEntry(
  entry: { mint: string; name?: string; symbol?: string; image?: string; decimals?: number; sellerFeeBasisPoints?: number },
  meta: MintMetadata | undefined
): MarketplaceConfig['currencyMints'][0] {
  return {
    mint: entry.mint,
    name: entry.name ?? meta?.name ?? '',
    symbol: entry.symbol ?? meta?.symbol ?? '',
    image: entry.image ?? meta?.image ?? undefined,
    decimals: entry.decimals ?? meta?.decimals ?? undefined,
    sellerFeeBasisPoints: entry.sellerFeeBasisPoints ?? meta?.sellerFeeBasisPoints ?? undefined,
  }
}

function mergeSplEntry(
  entry: { mint: string; name?: string; symbol?: string; image?: string; decimals?: number; sellerFeeBasisPoints?: number },
  meta: MintMetadata | undefined
): NonNullable<MarketplaceConfig['splAssetMints']>[0] {
  return {
    mint: entry.mint,
    name: entry.name ?? meta?.name ?? undefined,
    symbol: entry.symbol ?? meta?.symbol ?? undefined,
    image: entry.image ?? meta?.image ?? undefined,
    decimals: entry.decimals ?? meta?.decimals ?? undefined,
    sellerFeeBasisPoints: entry.sellerFeeBasisPoints ?? meta?.sellerFeeBasisPoints ?? undefined,
  }
}

/**
 * Enrich currencyMints and splAssetMints from a metadata map (e.g. from getMintMetadataBatch).
 * Config entries win when they have a value; otherwise metadata from the map is used.
 */
export function enrichMarketplaceConfigWithMetadata(
  config: MarketplaceConfig,
  metadataMap: Map<string, MintMetadata>
): MarketplaceConfig {
  const currencyMints = config.currencyMints.map((c) =>
    mergeCurrencyEntry(c, metadataMap.get(c.mint))
  )
  const splAssetMints = (config.splAssetMints ?? []).map((s) =>
    mergeSplEntry(s, metadataMap.get(s.mint))
  )
  return {
    ...config,
    currencyMints,
    splAssetMints,
  }
}

/**
 * Resolve marketplace config for tenant and enrich currency/spl mints with metadata from DB.
 * Returns null if config not found or DB not available.
 */
export async function resolveMarketplaceEnriched(
  tenantId: string
): Promise<MarketplaceConfig | null> {
  const config = await resolveMarketplace(tenantId)
  if (!config || !getPool()) return config
  const mints = [
    ...config.currencyMints.map((c) => c.mint),
    ...(config.splAssetMints ?? []).map((s) => s.mint),
  ]
  const metadataMap = await getMintMetadataBatch(mints)
  return enrichMarketplaceConfigWithMetadata(config, metadataMap)
}
