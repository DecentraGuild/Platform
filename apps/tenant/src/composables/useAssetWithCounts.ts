/**
 * Computes offer/request counts for marketplace assets from escrow data.
 * Handles NFT collections (aggregate member mints) and single-mint assets.
 */
import type { MarketplaceAsset } from './useMarketplaceAssets'
import type { TradesByMint } from './useEscrowsForMints'

export interface AssetWithCounts extends MarketplaceAsset {
  offerCount: number
  requestCount: number
}

export function assetWithCounts(
  asset: MarketplaceAsset,
  byMint: Map<string, TradesByMint>,
  mintsByCollection: Map<string, string[]>
): AssetWithCounts {
  let offerCount = 0
  let requestCount = 0
  if (
    asset.assetType === 'NFT_COLLECTION' &&
    asset.collectionMint &&
    asset.mint === asset.collectionMint
  ) {
    const memberMints = mintsByCollection.get(asset.mint) ?? []
    for (const m of memberMints) {
      const entry = byMint.get(m)
      if (entry) {
        offerCount += entry.offerTrades.length
        requestCount += entry.requestTrades.length
      }
    }
  } else {
    const entry = byMint.get(asset.mint)
    offerCount = entry?.offerTrades.length ?? 0
    requestCount = entry?.requestTrades.length ?? 0
  }
  return { ...asset, offerCount, requestCount }
}
