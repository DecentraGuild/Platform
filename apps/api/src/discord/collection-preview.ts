/**
 * Build collection-preview response: trait keys and options from a mint (fungible, collection, or single NFT).
 * Used by GET .../discord/collection-preview. Optionally upserts mint metadata to DB when iterating items.
 * Use traitsOnly: true when you only need trait dropdowns (e.g. rule form); skips per-item DB writes and can cap scan size for speed.
 */

import { fetchAsset, fetchAssetsByGroup } from '@decentraguild/web3'
import { getPool } from '../db/client.js'
import { getMintMetadata, upsertMintMetadata } from '../db/marketplace-metadata.js'
import { traitsFromDasAsset } from '../marketplace/das-traits.js'
import { isFungible, hasCollectionGrouping } from './rules-helpers.js'

export interface CollectionPreviewOptions {
  /** When true, only aggregate traits in memory; do not upsert mint_metadata for each item. Much faster for large collections. */
  traitsOnly?: boolean
  /** When traitsOnly, stop after this many items so dropdowns load quickly. Trait list may be partial for huge collections. Default 2500. */
  maxItems?: number
}

export interface CollectionPreviewResponse {
  mint: string
  name: string | null
  image: string | null
  trait_keys: string[]
  trait_options: Record<string, string[]>
  items_loaded: number
}

interface CollectionPreviewLog {
  warn?: (obj: unknown, msg?: string) => void
}

function addTraitsToMaps(
  traits: Array<{ trait_type: string; value: string | number }>,
  traitKeysSet: Set<string>,
  traitOptionsMap: Map<string, Set<string>>
): void {
  for (const t of traits) {
    const key = t.trait_type.trim()
    if (!key) continue
    traitKeysSet.add(key)
    const val = String(t.value).trim()
    if (!val) continue
    let set = traitOptionsMap.get(key)
    if (!set) {
      set = new Set<string>()
      traitOptionsMap.set(key, set)
    }
    set.add(val)
  }
}

function buildTraitOutput(
  traitKeysSet: Set<string>,
  traitOptionsMap: Map<string, Set<string>>
): { trait_keys: string[]; trait_options: Record<string, string[]> } {
  const trait_keys = [...traitKeysSet].sort()
  const trait_options: Record<string, string[]> = {}
  for (const k of trait_keys) {
    trait_options[k] = [...(traitOptionsMap.get(k) ?? [])].sort()
  }
  return { trait_keys, trait_options }
}

/**
 * Fetch asset by mint, aggregate trait keys/options, optionally persist metadata for collection items.
 * Throws on asset not found or RPC failure.
 * Use options.traitsOnly for fast trait dropdown loading (no per-item DB writes, optional item cap).
 */
export async function buildCollectionPreview(
  mint: string,
  log?: CollectionPreviewLog,
  options?: CollectionPreviewOptions
): Promise<CollectionPreviewResponse> {
  const asset = await fetchAsset(mint)
  if (!asset) {
    throw new Error('Asset not found')
  }

  const traitsOnly = options?.traitsOnly === true
  const maxItems = options?.maxItems ?? (traitsOnly ? 2500 : undefined)

  const traitKeysSet = new Set<string>()
  const traitOptionsMap = new Map<string, Set<string>>()
  let name: string | null = asset.content?.metadata?.name ?? null
  let image: string | null = asset.content?.links?.image ?? null
  let itemsLoaded = 0
  const pool = getPool()

  if (isFungible(asset)) {
    const meta = pool ? await getMintMetadata(mint) : null
    const traits = meta?.traits ?? traitsFromDasAsset(asset)
    if (traits.length) {
      addTraitsToMaps(
        traits.map((t) => ({ trait_type: t.trait_type, value: t.value })),
        traitKeysSet,
        traitOptionsMap
      )
    }
    const { trait_keys, trait_options } = buildTraitOutput(traitKeysSet, traitOptionsMap)
    return {
      mint,
      name: name ?? meta?.name ?? null,
      image: image ?? meta?.image ?? null,
      trait_keys,
      trait_options,
      items_loaded: 0,
    }
  }

  if (hasCollectionGrouping(asset) || asset.id === mint) {
    let page = 1
    const limit = 1000
    let hasMore = true
    while (hasMore) {
      if (maxItems != null && itemsLoaded >= maxItems) break
      const resultPage = await fetchAssetsByGroup('collection', mint, page, limit)
      const items = resultPage?.items ?? []
      for (const item of items) {
        if (maxItems != null && itemsLoaded >= maxItems) break
        const itemMint = item.id ?? ''
        if (!itemMint) continue
        itemsLoaded++
        const meta = item.content?.metadata
        const traits = traitsFromDasAsset(item)
        if (traits.length) {
          if (!traitsOnly && pool) {
            const forDb = traits.map((t) => ({ trait_type: t.trait_type, value: t.value }))
            await upsertMintMetadata(itemMint, {
              name: meta?.name ?? null,
              symbol: meta?.symbol ?? null,
              image: item.content?.links?.image ?? null,
              decimals: item.token_info?.decimals ?? null,
              traits: forDb,
            }).catch((e) => log?.warn?.({ err: e, mint: itemMint }, 'Collection preview: mint metadata upsert skipped'))
          }
          addTraitsToMaps(
            traits.map((t) => ({ trait_type: t.trait_type, value: t.value })),
            traitKeysSet,
            traitOptionsMap
          )
        }
      }
      hasMore = items.length >= limit
      page++
    }
  } else {
    const traits = traitsFromDasAsset(asset)
    if (!traitsOnly && pool) {
      await upsertMintMetadata(mint, {
        name: asset.content?.metadata?.name ?? null,
        symbol: asset.content?.metadata?.symbol ?? null,
        image: asset.content?.links?.image ?? null,
        decimals: asset.token_info?.decimals ?? null,
        traits: traits.length ? traits.map((t) => ({ trait_type: t.trait_type, value: t.value })) : undefined,
      }).catch((e) => log?.warn?.({ err: e, mint }, 'Collection preview: single NFT metadata upsert skipped'))
    }
    if (traits.length) {
      itemsLoaded = 1
      addTraitsToMaps(
        traits.map((t) => ({ trait_type: t.trait_type, value: t.value })),
        traitKeysSet,
        traitOptionsMap
      )
    }
  }

  const { trait_keys, trait_options } = buildTraitOutput(traitKeysSet, traitOptionsMap)
  return {
    mint,
    name,
    image,
    trait_keys,
    trait_options,
    items_loaded: itemsLoaded,
  }
}
