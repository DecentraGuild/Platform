<template>
  <div class="market-browse">
    <nav v-if="breadcrumbs.length" class="market-browse__breadcrumbs">
      <button
        type="button"
        class="market-browse__breadcrumb market-browse__breadcrumb--root"
        @click="onBreadcrumbClick(null)"
      >
        Market
      </button>
      <span
        v-for="(seg, i) in breadcrumbs"
        :key="i"
        class="market-browse__breadcrumb-sep"
      >
        /
      </span>
      <button
        v-for="(seg, i) in breadcrumbs"
        :key="i"
        type="button"
        class="market-browse__breadcrumb"
        @click="onBreadcrumbClick(i)"
      >
        {{ seg }}
      </button>
    </nav>
    <StatusBanner
      v-if="rpcError && !apiBase"
      variant="error"
      :message="rpcError"
    />
    <StatusBanner
      v-else-if="!showItemDetail && (scopeLoading || assetsLoading)"
      variant="loading"
      message="Loading assets..."
    />
    <StatusBanner
      v-else-if="!showItemDetail && scopeError"
      variant="error"
      :message="scopeError"
      :retry="true"
      @retry="scopeRetry"
    />
    <MarketBrowseDetail
      v-else-if="showItemDetail && detailMint"
      :detail-mint="detailMint"
      :detail-asset="detailAsset"
      :detail-traits="detailTraits"
      :detail-trades="detailTradesFilteredAsEscrow"
      :solscan-token-url="solscanTokenUrl"
      :create-disabled="props.createDisabled"
      :escrow-link="escrowLink"
      @back="clearDetail"
      @open-create-trade="$emit('open-create-trade')"
      @copy-address="copyDetailMint"
    />
    <div v-else>
      <MarketBrowseToolbar
        v-if="isCollectionSelected && hasAnyTraits"
        v-model:search-query="browseSearchQuery"
        v-model:filters-open="browseFiltersOpen"
        :selected-traits="browseSelectedTraits"
        :unique-traits="browseUniqueTraits"
        :active-filter-count="browseActiveFilterCount"
        @toggle-filter="toggleBrowseTraitFilter"
        @clear-filters="clearBrowseTraitFilters"
      />
      <StatusBanner
        v-if="!assetCards.length"
        variant="empty"
        :message="emptyGridMessage"
      />
      <MarketBrowseGrid
        v-else
        :asset-cards="assetCards"
        v-model:grid-scale-rem="gridScaleRem"
        :get-display-symbol="getDisplaySymbol"
        @select="onAssetSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { StatusBanner } from '@decentraguild/ui/components'
import { useAuth } from '@decentraguild/auth'
import { useMarketplaceEscrowLinks } from '~/composables/useMarketplaceEscrowLinks'
import { useMarketBrowseData } from '../composables/useMarketBrowseData'
import { useMarketBrowseDetail } from '../composables/useMarketBrowseDetail'
import MarketBrowseToolbar from './MarketBrowseToolbar.vue'
import MarketBrowseDetail from './MarketBrowseDetail.vue'
import MarketBrowseGrid from './MarketBrowseGrid.vue'
import type { TreeNode } from '~/composables/useMarketplaceTree'
import type { EscrowWithAddress } from '@decentraguild/web3'

const props = withDefaults(
  defineProps<{
    childNodes: TreeNode[]
    descendantAssetNodes: TreeNode[]
    selectedNode: TreeNode | null
    selectedDetailMint: string | null
    breadcrumbPath: string[]
    selectNode: (id: string | null) => void
    selectNodeByBreadcrumbIndex: (index: number | null) => void
    setSelectedDetailMint: (mint: string | null) => void
    createDisabled?: boolean
  }>(),
  { createDisabled: false }
)

defineEmits<{ 'open-create-trade': [] }>()

const selectedNodeRef = toRef(props, 'selectedNode')
const descendantAssetNodesRef = toRef(props, 'descendantAssetNodes')

const {
  slug,
  marketplaceSettings,
  apiBase,
  rpcError,
  scopeLoading,
  scopeError,
  scopeRetry,
  assetsLoading,
  assets,
  byMint,
  isCollectionSelected,
  browseSearchQuery,
  browseSelectedTraits,
  browseFiltersOpen,
  browseUniqueTraits,
  hasAnyTraits,
  browseActiveFilterCount,
  toggleBrowseTraitFilter,
  clearBrowseTraitFilters,
  gridScaleRem,
  assetCards,
  emptyGridMessage,
  getDisplaySymbol,
} = useMarketBrowseData({
  selectedNode: selectedNodeRef,
  descendantAssetNodes: descendantAssetNodesRef,
})

const { escrowLink } = useMarketplaceEscrowLinks(slug)
const auth = useAuth()
const walletAddress = computed(() => auth.connectorState.value?.account ?? null)

const breadcrumbs = computed(() => props.breadcrumbPath)
const detailMint = computed(() => props.selectedDetailMint ?? null)

const {
  detailAsset,
  detailTraits,
  detailTradesFiltered,
  solscanTokenUrl,
  copyDetailMint,
} = useMarketBrowseDetail({
  detailMint,
  assets,
  marketplaceSettings,
  byMint,
  walletAddress,
})

const showItemDetail = computed(() => Boolean(detailMint.value))

const detailTradesFilteredAsEscrow = computed(() => ({
  offerTrades: detailTradesFiltered.value.offerTrades as EscrowWithAddress[],
  requestTrades: detailTradesFiltered.value.requestTrades as EscrowWithAddress[],
}))

function onAssetSelect(payload: { mint: string; assetType: string; collectionMint?: string | null }) {
  const isCollection = payload.assetType === 'NFT_COLLECTION' && payload.mint === payload.collectionMint
  if (isCollection) {
    props.selectNode(`asset:${payload.mint}`)
    props.setSelectedDetailMint(null)
  } else {
    props.setSelectedDetailMint(payload.mint)
    const inTree = props.childNodes.some((n) => n.kind === 'asset' && n.mint === payload.mint)
    if (inTree) props.selectNode(`asset:${payload.mint}`)
  }
}

function clearDetail() {
  props.setSelectedDetailMint(null)
}

function onBreadcrumbClick(index: number | null) {
  props.selectNodeByBreadcrumbIndex(index)
}
</script>

<style scoped>
.market-browse__breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: var(--theme-space-lg);
  font-size: var(--theme-font-sm);
}

.market-browse__breadcrumb {
  padding: 2px 4px;
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.market-browse__breadcrumb:hover {
  color: var(--theme-primary);
}

.market-browse__breadcrumb--root {
  font-weight: 500;
}

.market-browse__breadcrumb-sep {
  color: var(--theme-text-muted);
}
</style>
