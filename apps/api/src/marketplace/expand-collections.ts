/**
 * Expand marketplace config mints into marketplace_mint_scope.
 * Uses DAS getAsset first to infer type; getAssetsByGroup only when collection.
 */

import { fetchAsset, fetchAssetsByGroup, type DasAsset } from '@decentraguild/web3'
import { saveScopeForTenant, type ScopeEntry } from './scope.js'
import { upsertMintMetadata } from '../db/marketplace-metadata.js'
import { traitsFromDasAsset } from './das-traits.js'

interface SimpleLogger {
  warn?: (obj: unknown, msg?: string) => void
}

function isFungible(asset: DasAsset): boolean {
  const iface = asset.interface ?? ''
  return iface === 'FungibleAsset' || iface === 'FungibleToken'
}

function hasCollectionGrouping(asset: DasAsset): boolean {
  const groups = asset.grouping ?? []
  return groups.some((g) => g.group_key === 'collection')
}

export interface MarketplaceConfigMints {
  collectionMints: Array<{ mint: string }>
  currencyMints: Array<{ mint: string }>
  splAssetMints?: Array<{ mint: string }>
}

export async function expandAndSaveScope(
  tenantSlug: string,
  config: MarketplaceConfigMints,
  log?: SimpleLogger
): Promise<ScopeEntry[]> {
  const entries: ScopeEntry[] = []

  for (const { mint } of config.currencyMints) {
    if (!mint?.trim()) continue
    entries.push({ mint: mint.trim(), source: 'currency' })
  }

  for (const { mint } of config.splAssetMints ?? []) {
    if (!mint?.trim()) continue
    entries.push({ mint: mint.trim(), source: 'spl_asset' })
  }

  for (const { mint } of config.collectionMints) {
    if (!mint?.trim()) continue
    const collectionMint = mint.trim()

    const asset = await fetchAsset(collectionMint)
    if (!asset) {
      log?.warn?.({ mint: collectionMint }, 'DAS getAsset returned nothing for collection mint')
      entries.push({ mint: collectionMint, source: 'spl_asset', collectionMint: null })
      continue
    }

    if (isFungible(asset)) {
      entries.push({ mint: collectionMint, source: 'currency', collectionMint: null })
      continue
    }

    if (hasCollectionGrouping(asset) || asset.id === collectionMint) {
      entries.push({ mint: collectionMint, source: 'collection', collectionMint })

      let page = 1
      const limit = 1000
      let hasMore = true

      while (hasMore) {
        const result = await fetchAssetsByGroup('collection', collectionMint, page, limit)
        const items = result?.items ?? []
        for (const item of items) {
          const itemMint = item.id ?? ''
          if (itemMint) {
            entries.push({ mint: itemMint, source: 'collection', collectionMint })
            const meta = item.content?.metadata
            const traits = traitsFromDasAsset(item)
            if (meta || item.content?.links?.image || traits.length) {
              await upsertMintMetadata(itemMint, {
                name: meta?.name ?? null,
                symbol: meta?.symbol ?? null,
                image: item.content?.links?.image ?? null,
                decimals: item.token_info?.decimals ?? null,
                traits: traits.length ? traits : undefined,
              }).catch((e) => log?.warn?.({ err: e, mint: itemMint }, 'Mint metadata upsert skipped'))
            }
          }
        }
        hasMore = items.length >= limit
        page++
      }
    } else {
      entries.push({ mint: collectionMint, source: 'spl_asset', collectionMint: null })
    }
  }

  const seen = new Set<string>()
  const deduped: ScopeEntry[] = []
  for (const e of entries) {
    if (seen.has(e.mint)) continue
    seen.add(e.mint)
    deduped.push(e)
  }

  await saveScopeForTenant(tenantSlug, deduped)
  return deduped
}
