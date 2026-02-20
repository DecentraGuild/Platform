/**
 * NFT filter and search helpers. Shared by browse grid and NFT instance selector.
 * Adapted from C2C _integrate reference.
 */

export interface TraitAttribute {
  trait_type: string
  value: string | number
  display_type?: string
}

export function normaliseAttributes(
  attrs: Array<{ trait_type?: string; traitType?: string; value?: string | number }> | null | undefined
): TraitAttribute[] {
  if (!Array.isArray(attrs)) return []
  return attrs
    .map((a) => ({
      trait_type: String(a.trait_type ?? a.traitType ?? ''),
      value: a.value ?? '',
    }))
    .filter((a) => a.trait_type !== '' || a.value !== '')
}

export function filterNFTsBySearch<T extends { mint: string; name?: string; metadata?: { name?: string } | null }>(
  nfts: T[],
  query: string | null | undefined
): T[] {
  if (!query?.trim()) return nfts
  const q = query.trim().toLowerCase()
  if (q.length === 0) return nfts
  const qNum = q.replace(/^#/, '')
  return nfts.filter((nft) => {
    const name = ((nft.name ?? nft.metadata?.name) ?? '').toLowerCase()
    const mint = (nft.mint ?? '').toLowerCase()
    if (name.includes(q)) return true
    if (mint.includes(q) || mint.startsWith(q)) return true
    const numbersInName = name.match(/#?\d+/g) ?? []
    if (numbersInName.some((num) => num.replace('#', '') === qNum || num === q)) return true
    return false
  })
}

export function getUniqueTraits<T extends { metadata?: { traits?: TraitAttribute[] } | null }>(
  nfts: T[]
): Record<string, string[]> {
  const map: Record<string, Set<string>> = {}
  for (const nft of nfts) {
    const attrs = normaliseAttributes(nft.metadata?.traits ?? [])
    for (const { trait_type, value } of attrs) {
      if (!trait_type) continue
      if (!map[trait_type]) map[trait_type] = new Set()
      map[trait_type].add(String(value))
    }
  }
  const result: Record<string, string[]> = {}
  for (const [k, set] of Object.entries(map)) {
    result[k] = Array.from(set).sort()
  }
  return result
}

export function filterNFTsByTraits<T extends { metadata?: { traits?: TraitAttribute[] } | null }>(
  nfts: T[],
  selectedTraits: Record<string, string> | null | undefined
): T[] {
  const entries = Object.entries(selectedTraits ?? {}).filter(([, v]) => v != null && v !== '')
  if (entries.length === 0) return nfts
  return nfts.filter((nft) => {
    const attrs = normaliseAttributes(nft.metadata?.traits ?? [])
    const attrMap = Object.fromEntries(attrs.map((a) => [a.trait_type, String(a.value)]))
    for (const [traitType, selectedValue] of entries) {
      if (attrMap[traitType] !== selectedValue) return false
    }
    return true
  })
}
