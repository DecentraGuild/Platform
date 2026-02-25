/**
 * Single source of truth for resolving a mint address from marketplace settings.
 * Used by tree labels, escrow decimals, detail panel, and browse grid augmentation.
 */
import type { MarketplaceSettings } from '@decentraguild/core'
import type { MarketplaceAsset } from '~/composables/useMarketplaceAssets'

export interface MintInfoFromSettings {
  name: string | null
  symbol: string | null
  decimals: number
  image: string | null
  source: 'collection' | 'currency' | 'spl' | null
}

const FALLBACK_LABEL_LEN = 8

/**
 * Resolve name, symbol, decimals, and image for a mint from tenant marketplace settings.
 */
export function getMintInfoFromSettings(
  mint: string,
  settings: MarketplaceSettings | null
): MintInfoFromSettings {
  const empty: MintInfoFromSettings = {
    name: null,
    symbol: null,
    decimals: 0,
    image: null,
    source: null,
  }
  if (!settings) return empty

  const coll = settings.collectionMints?.find((c) => c.mint === mint)
  if (coll) {
    return {
      name: coll.name ?? null,
      symbol: null,
      decimals: 0,
      image: coll.image ?? null,
      source: 'collection',
    }
  }

  const curr = settings.currencyMints?.find((c) => c.mint === mint)
  if (curr) {
    return {
      name: curr.name ?? null,
      symbol: curr.symbol ?? null,
      decimals: curr.decimals ?? 0,
      image: curr.image ?? null,
      source: 'currency',
    }
  }

  const spl = settings.splAssetMints?.find((s) => s.mint === mint)
  if (spl) {
    return {
      name: spl.name ?? null,
      symbol: spl.symbol ?? null,
      decimals: spl.decimals ?? 0,
      image: spl.image ?? null,
      source: 'spl',
    }
  }

  return empty
}

/**
 * Display label for a mint (name or symbol or truncated address).
 */
export function getMintDisplayLabel(
  mint: string,
  settings: MarketplaceSettings | null
): string {
  const info = getMintInfoFromSettings(mint, settings)
  const label = info.name ?? info.symbol ?? null
  return label ?? `${mint.slice(0, FALLBACK_LABEL_LEN)}...`
}

/**
 * Build a MarketplaceAsset from settings when the mint is not in the API assets list.
 * Returns null if the mint is not in settings.
 */
export function getMarketplaceAssetFromSettings(
  mint: string,
  settings: MarketplaceSettings | null
): MarketplaceAsset | null {
  if (!settings) return null

  const curr = settings.currencyMints?.find((c) => c.mint === mint)
  if (curr) {
    return {
      assetType: 'CURRENCY',
      mint: curr.mint,
      collectionMint: null,
      metadata: {
        name: curr.name ?? null,
        symbol: curr.symbol ?? null,
        image: null,
        decimals: curr.decimals ?? null,
      },
    }
  }

  const spl = settings.splAssetMints?.find((s) => s.mint === mint)
  if (spl) {
    return {
      assetType: 'SPL_ASSET',
      mint: spl.mint,
      collectionMint: null,
      metadata: {
        name: spl.name ?? null,
        symbol: spl.symbol ?? null,
        image: null,
        decimals: spl.decimals ?? null,
      },
    }
  }

  const coll = settings.collectionMints?.find((c) => c.mint === mint)
  if (coll) {
    return {
      assetType: 'NFT_COLLECTION',
      mint: coll.mint,
      collectionMint: coll.mint,
      metadata: {
        name: coll.name ?? null,
        symbol: null,
        image: coll.image ?? null,
        decimals: null,
      },
    }
  }

  return null
}
