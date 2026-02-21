/**
 * Centralised DAS (Digital Asset Standard) trait extraction.
 * Same list/shape as mint_metadata.traits, used by marketplace scope expansion,
 * Discord collection-preview, and asset-preview. Single source of truth for
 * "attributes from chain" -> stored/displayed traits.
 */

import type { DasAsset } from '@decentraguild/web3'
import type { MintTrait } from '../db/marketplace-metadata.js'

/**
 * Extract traits from a DAS asset in the same shape as mint_metadata.traits.
 * Used when indexing collections (expand-collections, Discord collection-preview)
 * and when building trait type lists (asset-preview).
 */
export function traitsFromDasAsset(asset: DasAsset): MintTrait[] {
  const attrs = asset.content?.metadata?.attributes
  if (!Array.isArray(attrs) || attrs.length === 0) return []
  return attrs
    .filter((a) => a?.trait_type != null && a?.value != null)
    .map((a) => ({
      trait_type: String(a.trait_type),
      value: a.value as string | number,
      display_type: a.display_type,
    }))
}
