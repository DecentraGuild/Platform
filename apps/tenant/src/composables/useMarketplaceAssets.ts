/**
 * Paginated marketplace assets from API.
 * Combine with useEscrowsForMints to overlay real offer/request counts.
 * Returns scope (mints, entries) when API includes it.
 */
import type { ScopeEntry } from './useMarketplaceScope'

export type AssetType = 'CURRENCY' | 'NFT_COLLECTION' | 'SPL_ASSET'

export interface MintTrait {
  trait_type: string
  value: string | number
  display_type?: string
}

export interface MarketplaceAsset {
  assetType: AssetType
  mint: string
  collectionMint: string | null
  metadata: {
    name: string | null
    symbol: string | null
    image: string | null
    decimals: number | null
    traits?: MintTrait[] | null
  } | null
}

export interface UseMarketplaceAssetsOptions {
  slug: Ref<string | null>
  page?: Ref<number>
  limit?: number
  collection?: Ref<string | null>
  search?: Ref<string>
}

export function useMarketplaceAssets(options: UseMarketplaceAssetsOptions) {
  const {
    slug,
    page = ref(1),
    limit = 24,
    collection = ref(null),
    search = ref(''),
  } = options

  const apiBase = useApiBase()

  const assets = ref<MarketplaceAsset[]>([])
  const total = ref(0)
  const scope = ref<{ mints: string[]; entries: ScopeEntry[] } | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const mintsSet = computed(() => new Set(scope.value?.mints ?? []))
  const mintsByCollection = computed(() => {
    const map = new Map<string, string[]>()
    for (const e of scope.value?.entries ?? []) {
      if (e.collectionMint) {
        const list = map.get(e.collectionMint) ?? []
        list.push(e.mint)
        map.set(e.collectionMint, list)
      }
    }
    return map
  })

  async function load() {
    const s = slug.value
    if (!s) {
      assets.value = []
      total.value = 0
      scope.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      params.set('page', String(page.value))
      params.set('limit', String(limit))
      if (collection.value) params.set('collection', collection.value)
      if (search.value?.trim()) params.set('search', search.value.trim())

      const res = await fetch(
        `${apiBase.value}/api/v1/tenant/${encodeURIComponent(s)}/marketplace/assets?${params}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        assets?: MarketplaceAsset[]
        total?: number
        page?: number
        limit?: number
        scope?: { mints?: string[]; entries?: ScopeEntry[] }
      }
      assets.value = Array.isArray(data.assets) ? data.assets : []
      total.value = data.total ?? 0
      scope.value = data.scope
        ? {
            mints: data.scope.mints ?? [],
            entries: data.scope.entries ?? [],
          }
        : null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load assets'
      assets.value = []
      total.value = 0
      scope.value = null
    } finally {
      loading.value = false
    }
  }

  watch([slug, page, collection, search], () => load(), { immediate: true })

  return {
    assets,
    total,
    scope,
    mintsSet,
    mintsByCollection,
    loading,
    error,
    retry: load,
  }
}
