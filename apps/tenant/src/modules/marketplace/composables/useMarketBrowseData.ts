/**
 * Data and state for the marketplace browse view: scope, assets, escrows, filters, grid.
 * Use in MarketBrowseView to keep the component thin.
 */
import type { Ref } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTenantStore } from '~/stores/tenant'
import { useApiBase } from '~/composables/useApiBase'
import { useRpc } from '~/composables/useRpc'
import { useMarketplaceScope } from '~/composables/useMarketplaceScope'
import { useMarketplaceAssets } from '~/composables/useMarketplaceAssets'
import { useEscrowsForMints } from '~/composables/useEscrowsForMints'
import { assetWithCounts } from '~/composables/useAssetWithCounts'
import { useMarketBrowseFilters } from './useMarketBrowseFilters'
import { getMarketplaceAssetFromSettings, getMintInfoFromSettings } from '~/utils/mintFromSettings'
import type { TreeNode } from '~/composables/useMarketplaceTree'
import type { MarketplaceAsset } from '~/composables/useMarketplaceAssets'

const MARKET_GRID_SCALE_KEY = 'market-grid-scale'
const DEFAULT_GRID_SCALE_REM = 16
const GRID_SCALE_MIN = 14
const GRID_SCALE_MAX = 25

export interface UseMarketBrowseDataOptions {
  selectedNode: Ref<TreeNode | null>
  descendantAssetNodes: Ref<TreeNode[]>
}

export function useMarketBrowseData(options: UseMarketBrowseDataOptions) {
  const { selectedNode, descendantAssetNodes } = options
  const tenantStore = useTenantStore()
  const { slug, marketplaceSettings } = storeToRefs(tenantStore)
  const apiBase = useApiBase()
  const { rpcUrl, rpcError } = useRpc()

  const collectionRef = computed(() => {
    const node = selectedNode.value
    if (!node || node.kind !== 'asset' || !node.mint) return null
    if (node.mint === node.collectionMint) return node.mint
    return null
  })

  const {
    entries,
    mintsSet: scopeMintsSet,
    mintsByCollection,
    loading: scopeLoading,
    error: scopeError,
    retry: scopeRetry,
  } = useMarketplaceScope(slug)

  const scopeMints = computed(() => entries.value.map((e) => e.mint))

  const {
    assets,
    mintsByCollection: assetsMintsByCollection,
    loading: assetsLoading,
  } = useMarketplaceAssets({
    slug,
    collection: collectionRef,
    limit: 500,
  })

  const rpcUrlRef = computed(() => rpcUrl)
  const { byMint, retry: escrowsRetry } = useEscrowsForMints(scopeMintsSet, rpcUrlRef, {
    apiUrl: apiBase,
    slug,
  })

  onMounted(() => {
    if (apiBase.value || rpcUrl.value) escrowsRetry()
  })

  const isCollectionSelected = computed(
    () =>
      selectedNode.value?.kind === 'asset' &&
      selectedNode.value?.mint &&
      selectedNode.value?.mint === selectedNode.value?.collectionMint
  )

  const descendantAssetMints = computed(() =>
    new Set(
      descendantAssetNodes.value
        .filter((n): n is TreeNode & { mint: string } => n.kind === 'asset' && Boolean(n.mint))
        .map((n) => n.mint)
    )
  )

  const assetCardsAll = computed(() => {
    const targetMints = descendantAssetMints.value
    if (isCollectionSelected.value) {
      return assets.value.filter(
        (a) => !(a.assetType === 'NFT_COLLECTION' && a.mint === a.collectionMint)
      )
    }
    if (targetMints.size === 0) return []
    const fromAssets = assets.value.filter((a) => targetMints.has(a.mint))
    const missing = [...targetMints].filter((m) => !fromAssets.some((a) => a.mint === m))
    if (missing.length === 0) return fromAssets
    const settings = marketplaceSettings.value
    if (!settings) return fromAssets
    const augmented: MarketplaceAsset[] = [...fromAssets]
    for (const mint of missing) {
      const fromSettings = getMarketplaceAssetFromSettings(mint, settings)
      if (fromSettings) augmented.push(fromSettings)
    }
    return augmented
  })

  const {
    browseSearchQuery,
    browseSelectedTraits,
    browseFiltersOpen,
    browseUniqueTraits,
    hasAnyTraits,
    browseActiveFilterCount,
    assetCardsFiltered,
    toggleBrowseTraitFilter,
    clearBrowseTraitFilters,
    resetFilters,
  } = useMarketBrowseFilters({ assetCardsAll })

  const gridScaleRem = ref(DEFAULT_GRID_SCALE_REM)
  onMounted(() => {
    try {
      const stored = localStorage.getItem(MARKET_GRID_SCALE_KEY)
      if (stored != null) {
        const n = parseInt(stored, 10)
        if (n >= GRID_SCALE_MIN && n <= GRID_SCALE_MAX) gridScaleRem.value = n
      }
    } catch {
      // ignore
    }
  })
  watch(gridScaleRem, (v) => {
    try {
      localStorage.setItem(MARKET_GRID_SCALE_KEY, String(v))
    } catch {
      // ignore
    }
  }, { immediate: false })

  const mintsByCollectionMerged = computed(() => {
    const s = mintsByCollection.value
    const a = assetsMintsByCollection.value
    if (!a) return s
    const merged = new Map(s)
    for (const [k, v] of a) {
      if (!merged.has(k)) merged.set(k, v)
    }
    return merged
  })

  const assetCards = computed(() => {
    const merged = mintsByCollectionMerged.value
    const withCounts = assetCardsFiltered.value.map((a) => assetWithCounts(a, byMint.value, merged))
    return [...withCounts].sort((a, b) => {
      const aHasTrade = (a.offerCount ?? 0) + (a.requestCount ?? 0) > 0 ? 1 : 0
      const bHasTrade = (b.offerCount ?? 0) + (b.requestCount ?? 0) > 0 ? 1 : 0
      if (bHasTrade !== aHasTrade) return bHasTrade - aHasTrade
      const aName = (a.metadata?.name ?? a.mint).toLowerCase()
      const bName = (b.metadata?.name ?? b.mint).toLowerCase()
      return aName.localeCompare(bName)
    })
  })

  const emptyGridMessage = computed(() => {
    if (scopeMints.value.length === 0) return 'No assets in scope.'
    if (browseActiveFilterCount.value || browseSearchQuery.value) return 'No items match your filters.'
    return 'No items to display.'
  })

  watch(
    () => selectedNode.value?.id,
    () => { resetFilters() }
  )

  function getDisplaySymbol(asset: {
    metadata?: { symbol?: string | null } | null
    collectionMint?: string | null
    mint?: string
  }): string | null {
    if (asset.metadata?.symbol) return asset.metadata.symbol
    const mint = asset.collectionMint ?? asset.mint
    if (mint) {
      const info = getMintInfoFromSettings(mint, marketplaceSettings.value)
      return info.symbol ?? info.name ?? null
    }
    return null
  }

  return {
    slug,
    marketplaceSettings,
    apiBase,
    rpcUrl,
    rpcError,
    scopeLoading,
    scopeError,
    scopeRetry,
    scopeMints,
    assets,
    assetsLoading,
    byMint,
    isCollectionSelected,
    browseSearchQuery,
    browseSelectedTraits,
    browseFiltersOpen,
    browseUniqueTraits,
    hasAnyTraits,
    browseActiveFilterCount,
    assetCardsFiltered,
    toggleBrowseTraitFilter,
    clearBrowseTraitFilters,
    resetFilters,
    gridScaleRem,
    assetCards,
    emptyGridMessage,
    getDisplaySymbol,
  }
}
