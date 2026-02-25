/**
 * Browse filters: search query, trait selection, and filtered asset list.
 * Used by MarketBrowseView; resets when selected node changes (call resetFilters from a watcher).
 */
import type { Ref } from 'vue'
import { computed, ref } from 'vue'
import {
  filterNFTsBySearch,
  filterNFTsByTraits,
  getUniqueTraits,
} from '~/utils/nftFilterHelpers'
import type { MarketplaceAsset } from '~/composables/useMarketplaceAssets'

export interface UseMarketBrowseFiltersOptions {
  /** All asset cards (before search/trait filter). */
  assetCardsAll: Ref<MarketplaceAsset[]>
}

export function useMarketBrowseFilters(options: UseMarketBrowseFiltersOptions) {
  const { assetCardsAll } = options

  const browseSearchQuery = ref('')
  const browseSelectedTraits = ref<Record<string, string>>({})
  const browseFiltersOpen = ref(false)

  const browseUniqueTraits = computed(() => getUniqueTraits(assetCardsAll.value))
  const hasAnyTraits = computed(() => Object.keys(browseUniqueTraits.value).length > 0)
  const browseActiveFilterCount = computed(() => Object.keys(browseSelectedTraits.value).length)

  const assetCardsFiltered = computed(() => {
    const afterSearch = filterNFTsBySearch(assetCardsAll.value, browseSearchQuery.value)
    return filterNFTsByTraits(afterSearch, browseSelectedTraits.value)
  })

  function toggleBrowseTraitFilter(traitType: string, value: string) {
    const next = { ...browseSelectedTraits.value }
    if (next[traitType] === value) delete next[traitType]
    else next[traitType] = value
    browseSelectedTraits.value = next
  }

  function clearBrowseTraitFilters() {
    browseSelectedTraits.value = {}
  }

  function resetFilters() {
    browseSearchQuery.value = ''
    browseSelectedTraits.value = {}
    browseFiltersOpen.value = false
  }

  return {
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
  }
}
