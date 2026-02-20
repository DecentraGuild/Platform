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
    <div v-else-if="showItemDetail" class="market-browse__detail">
      <div class="market-browse__detail-meta">
        <div class="market-browse__detail-media">
          <img
            v-if="detailAsset?.metadata?.image"
            :src="detailAsset.metadata.image"
            :alt="detailAsset.metadata.name ?? detailMint"
            class="market-browse__detail-img"
          />
          <div v-else class="market-browse__detail-placeholder">
            <Icon icon="mdi:image-off" />
          </div>
        </div>
        <div class="market-browse__detail-info">
          <div class="market-browse__detail-info-text">
            <h2 class="market-browse__detail-name">{{ detailAsset?.metadata?.name ?? truncateAddress(detailMint) }}</h2>
            <div class="market-browse__detail-ticker-row">
              <span v-if="detailAsset?.metadata?.symbol" class="market-browse__detail-symbol">{{ detailAsset.metadata.symbol }}</span>
              <button
                type="button"
                class="market-browse__detail-icon-btn"
                aria-label="Copy address"
                @click="copyDetailMint"
              >
                <Icon icon="mdi:content-copy" />
              </button>
              <a
                :href="solscanTokenUrl"
                target="_blank"
                rel="noopener"
                class="market-browse__detail-icon-btn market-browse__detail-solscan"
                aria-label="Jump to Solscan"
              >
                <Icon icon="mdi:open-in-new" />
              </a>
            </div>
            <code class="market-browse__detail-address">{{ detailMint }}</code>
            <div v-if="detailTraits.length" class="market-browse__detail-traits">
              <p class="market-browse__detail-traits-label">Traits</p>
              <div class="market-browse__detail-traits-list">
                <span
                  v-for="(attr, idx) in detailTraits"
                  :key="idx"
                  class="market-browse__detail-trait-tag"
                >
                  {{ attr.trait_type }}: {{ attr.value }}
                </span>
              </div>
            </div>
          </div>
          <div class="market-browse__detail-actions">
            <button type="button" class="market-browse__detail-btn market-browse__detail-btn--back" @click="clearDetail">
              <Icon icon="mdi:arrow-left" class="market-browse__detail-btn-icon" />
              <span class="market-browse__detail-btn-label">Back</span>
            </button>
            <button type="button" class="market-browse__detail-btn market-browse__detail-btn--create" @click="$emit('open-create-trade')">
              <Icon icon="mdi:plus" class="market-browse__detail-btn-icon" />
              <span class="market-browse__detail-btn-label">Create</span>
            </button>
          </div>
        </div>
      </div>
      <div class="market-browse__detail-trades">
        <TradeList
          :offer-trades="detailTradesFiltered.offerTrades"
          :request-trades="detailTradesFiltered.requestTrades"
          :escrow-link="escrowLink"
        />
      </div>
    </div>
      <div v-else>
      <div v-if="isCollectionSelected && hasAnyTraits" class="market-browse__toolbar">
        <input
          v-model="browseSearchQuery"
          type="text"
          class="market-browse__search"
          placeholder="Search by name, number, or mint..."
        />
        <div class="market-browse__filters">
          <button
            type="button"
            class="market-browse__filter-btn"
            :class="{ 'market-browse__filter-btn--active': browseFiltersOpen }"
            @click="browseFiltersOpen = !browseFiltersOpen"
          >
            <Icon icon="mdi:filter-outline" />
            Filters
            <span v-if="browseActiveFilterCount" class="market-browse__filter-badge">{{ browseActiveFilterCount }}</span>
          </button>
          <div v-if="browseFiltersOpen" class="market-browse__filter-panel">
            <div class="market-browse__filter-header">
              <span>Filter by traits</span>
              <button v-if="browseActiveFilterCount" type="button" @click="clearBrowseTraitFilters">Clear all</button>
            </div>
            <div v-for="(values, traitType) in browseUniqueTraits" :key="traitType" class="market-browse__trait-group">
              <p class="market-browse__trait-label">{{ traitType }}</p>
              <div class="market-browse__trait-values">
                <button
                  v-for="val in values"
                  :key="`${traitType}-${val}`"
                  type="button"
                  class="market-browse__trait-chip"
                  :class="{ 'market-browse__trait-chip--active': browseSelectedTraits[traitType] === val }"
                  @click="toggleBrowseTraitFilter(traitType, val)"
                >
                  {{ val }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <StatusBanner
        v-if="!gridItems.length"
        variant="empty"
        :message="scopeMints.length === 0 ? 'No assets in scope.' : browseActiveFilterCount || browseSearchQuery ? 'No items match your filters.' : 'No items to display.'"
      />
      <div v-else>
      <div class="market-browse__grid">
        <AssetCard
          v-for="asset in assetCards"
          :key="asset.mint"
          :mint="asset.mint"
          :asset-type="asset.assetType"
          :name="asset.metadata?.name ?? null"
          :symbol="getDisplaySymbol(asset)"
          :image="asset.metadata?.image ?? null"
          :offer-count="asset.offerCount"
          :request-count="asset.requestCount"
          :collection-mint="asset.collectionMint"
          @select="onAssetSelect"
        />
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { Button, StatusBanner } from '@decentraguild/ui/components'
import { useAuth } from '@decentraguild/auth'
import { truncateAddress } from '@decentraguild/display'
import { useTenantStore } from '~/stores/tenant'
import { useRpc } from '~/composables/useRpc'
import { useMarketplaceScope } from '~/composables/useMarketplaceScope'
import { useMarketplaceAssets } from '~/composables/useMarketplaceAssets'
import { useEscrowsForMints } from '~/composables/useEscrowsForMints'
import AssetCard from './AssetCard.vue'
import TradeList from './TradeList.vue'
import { assetWithCounts } from '~/composables/useAssetWithCounts'
import { useMarketplaceEscrowLinks } from '~/composables/useMarketplaceEscrowLinks'
import { useApiBase } from '~/composables/useApiBase'
import {
  filterNFTsBySearch,
  filterNFTsByTraits,
  getUniqueTraits,
  normaliseAttributes,
} from '~/utils/nftFilterHelpers'
import type { TreeNode } from '~/composables/useMarketplaceTree'
import type { MarketplaceAsset } from '~/composables/useMarketplaceAssets'

const props = defineProps<{
  childNodes: TreeNode[]
  descendantAssetNodes: TreeNode[]
  selectedNode: TreeNode | null
  selectedDetailMint: string | null
  breadcrumbPath: string[]
  selectNode: (id: string | null) => void
  setSelectedDetailMint: (mint: string | null) => void
}>()

defineEmits<{ 'open-create-trade': [] }>()

const tenantStore = useTenantStore()
const { slug, marketplaceSettings } = storeToRefs(tenantStore)
const auth = useAuth()
const walletAddress = computed(() => auth.connectorState.value?.account ?? null)

const apiBase = useApiBase()
const { rpcUrl, rpcError } = useRpc()
const { escrowLink } = useMarketplaceEscrowLinks(slug)

const collectionRef = computed(() => {
  const node = props.selectedNode
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
  scope,
  mintsSet,
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

const breadcrumbs = computed(() => props.breadcrumbPath)

const isCollectionSelected = computed(
  () =>
    props.selectedNode?.kind === 'asset' &&
    props.selectedNode?.mint &&
    props.selectedNode?.mint === props.selectedNode?.collectionMint
)

const descendantAssetMints = computed(() =>
  new Set(
    props.descendantAssetNodes
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
    const curr = settings.currencyMints?.find((c) => c.mint === mint)
    if (curr) {
      augmented.push({
        assetType: 'CURRENCY',
        mint: curr.mint,
        collectionMint: null,
        metadata: { name: curr.name ?? null, symbol: curr.symbol ?? null, image: null, decimals: null },
      })
      continue
    }
    const spl = settings.splAssetMints?.find((s) => s.mint === mint)
    if (spl) {
      augmented.push({
        assetType: 'SPL_ASSET',
        mint: spl.mint,
        collectionMint: null,
        metadata: { name: spl.name ?? null, symbol: spl.symbol ?? null, image: null, decimals: null },
      })
    }
  }
  return augmented
})

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

const gridItems = computed(() => assetCards.value)

watch(
  () => props.selectedNode?.id,
  () => {
    browseSearchQuery.value = ''
    browseSelectedTraits.value = {}
    browseFiltersOpen.value = false
  }
)

function toggleBrowseTraitFilter(traitType: string, value: string) {
  const next = { ...browseSelectedTraits.value }
  if (next[traitType] === value) delete next[traitType]
  else next[traitType] = value
  browseSelectedTraits.value = next
}

function clearBrowseTraitFilters() {
  browseSelectedTraits.value = {}
}

const detailMint = computed(() => props.selectedDetailMint)

const showItemDetail = computed(() => Boolean(detailMint.value))

const detailTraits = computed(() => {
  const asset = detailAsset.value
  if (!asset?.metadata?.traits) return []
  return normaliseAttributes(asset.metadata.traits)
})

const detailAsset = computed(() => {
  if (!detailMint.value) return null
  const fromApi = assets.value.find((a) => a.mint === detailMint.value)
  if (fromApi) return fromApi
  const settings = marketplaceSettings.value
  if (!settings) return null
  const fromCurrency = settings.currencyMints?.find((c) => c.mint === detailMint.value)
  if (fromCurrency) {
    return {
      assetType: 'CURRENCY' as const,
      mint: fromCurrency.mint,
      collectionMint: null,
      metadata: {
        name: fromCurrency.name ?? null,
        symbol: fromCurrency.symbol ?? null,
        image: null,
        decimals: null,
      },
    }
  }
  const fromSpl = settings.splAssetMints?.find((s) => s.mint === detailMint.value)
  if (fromSpl) {
    return {
      assetType: 'SPL_ASSET' as const,
      mint: fromSpl.mint,
      collectionMint: null,
      metadata: {
        name: fromSpl.name ?? null,
        symbol: fromSpl.symbol ?? null,
        image: null,
        decimals: null,
      },
    }
  }
  const fromColl = settings.collectionMints?.find((c) => c.mint === detailMint.value)
  if (fromColl) {
    return {
      assetType: 'NFT_COLLECTION' as const,
      mint: fromColl.mint,
      collectionMint: fromColl.mint,
      metadata: {
        name: fromColl.name ?? null,
        symbol: null,
        image: fromColl.image ?? null,
        decimals: null,
      },
    }
  }
  return null
})

const SYSTEM_PROGRAM = '11111111111111111111111111111111'

function isEscrowEligibleToFill(
  e: { account: { onlyRecipient: boolean; onlyWhitelist: boolean; recipient: { toBase58: () => string } } },
  wallet: string | null
): boolean {
  if (e.account.onlyWhitelist) return false
  if (!e.account.onlyRecipient) return true
  const rec = e.account.recipient.toBase58()
  if (rec === SYSTEM_PROGRAM) return true
  return wallet !== null && rec === wallet
}

const detailTrades = computed(() => {
  const m = detailMint.value
  if (!m) return { offerTrades: [], requestTrades: [] }
  return byMint.value.get(m) ?? { offerTrades: [], requestTrades: [] }
})

const detailTradesFiltered = computed(() => {
  const raw = detailTrades.value
  const wallet = walletAddress.value
  const filter = (list: typeof raw.offerTrades) =>
    list.filter((e) => isEscrowEligibleToFill(e, wallet))
  return {
    offerTrades: filter(raw.offerTrades),
    requestTrades: filter(raw.requestTrades),
  }
})

function getDisplaySymbol(asset: { metadata?: { symbol?: string | null } | null; collectionMint?: string | null }): string | null {
  if (asset.metadata?.symbol) return asset.metadata.symbol
  if (asset.collectionMint && marketplaceSettings.value?.collectionMints) {
    const coll = marketplaceSettings.value.collectionMints.find((c) => c.mint === asset.collectionMint)
    return coll?.name ?? null
  }
  return null
}

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

const solscanTokenUrl = computed(() =>
  detailMint.value ? `https://solscan.io/token/${detailMint.value}` : '#'
)

function copyDetailMint() {
  if (!detailMint.value) return
  void navigator.clipboard.writeText(detailMint.value)
}

function onBreadcrumbClick(index: number | null) {
  props.setSelectedDetailMint(null)
  if (index === null) {
    props.selectNode(null)
    return
  }
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

.market-browse__toolbar {
  display: flex;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-md);
}

.market-browse__search {
  flex: 1;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.market-browse__filters {
  position: relative;
}

.market-browse__filter-btn {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-primary);
  cursor: pointer;
}

.market-browse__filter-btn--active {
  border-color: var(--theme-primary);
}

.market-browse__filter-badge {
  min-width: 1.25rem;
  padding: 0 4px;
  font-size: var(--theme-font-xs);
  background: var(--theme-primary);
  color: white;
  border-radius: 999px;
}

.market-browse__filter-panel {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: var(--theme-space-xs);
  min-width: 14rem;
  max-height: 20rem;
  overflow-y: auto;
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  padding: var(--theme-space-sm);
  z-index: 10;
}

.market-browse__filter-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.market-browse__trait-group {
  margin-bottom: var(--theme-space-sm);
}

.market-browse__trait-label {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.market-browse__trait-values {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.market-browse__trait-chip {
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.market-browse__trait-chip--active {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}

.market-browse__empty {
  padding: var(--theme-space-xl);
  text-align: center;
  color: var(--theme-text-muted);
}

.market-browse__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: var(--theme-space-sm);
}

.market-browse__node-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-md);
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  cursor: pointer;
  color: var(--theme-text-primary);
}

.market-browse__node-card:hover {
  border-color: var(--theme-primary);
}

.market-browse__node-icon {
  font-size: 1.5rem;
  color: var(--theme-text-secondary);
}

.market-browse__node-label {
  font-size: var(--theme-font-xs);
  text-align: center;
}

.market-browse__detail {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: var(--theme-space-xl);
}

@media (max-width: 768px) {
  .market-browse__detail {
    grid-template-columns: 1fr;
  }
}

.market-browse__detail-meta {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.market-browse__detail-info {
  display: flex;
  align-items: flex-start;
  gap: var(--theme-space-md);
}

.market-browse__detail-info-text {
  flex: 1;
  min-width: 0;
}

.market-browse__detail-media {
  aspect-ratio: 1;
  background: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-lg);
  overflow: hidden;
}

.market-browse__detail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.market-browse__detail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--theme-text-muted);
}

.market-browse__detail-name {
  font-size: var(--theme-font-xl);
  font-weight: 600;
  margin: 0;
}

.market-browse__detail-ticker-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--theme-space-xs);
  margin: 0;
  min-width: 0;
}

.market-browse__detail-ticker-row .market-browse__detail-symbol {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin: 0;
  flex-shrink: 0;
}

.market-browse__detail-ticker-row .market-browse__detail-icon-btn {
  flex-shrink: 0;
}

.market-browse__detail-address {
  display: block;
  margin: var(--theme-space-xs) 0 0;
  font-size: var(--theme-font-xs);
  font-family: ui-monospace, monospace;
  word-break: break-all;
  color: var(--theme-text-secondary);
}

.market-browse__detail-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  text-decoration: none;
}

.market-browse__detail-icon-btn:hover {
  color: var(--theme-text-primary);
}

.market-browse__detail-solscan {
  /* same as copy, icon-only link */
}

.market-browse__detail-traits {
  margin-top: var(--theme-space-sm);
}

.market-browse__detail-traits-label {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.market-browse__detail-traits-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.market-browse__detail-trait-tag {
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
}

.market-browse__detail-actions {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
  flex-shrink: 0;
}

.market-browse__detail-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 3rem;
  height: 3rem;
  padding: var(--theme-space-xs);
  font-weight: 500;
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.market-browse__detail-btn-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.market-browse__detail-btn-label {
  font-size: 10px;
  line-height: 1;
}

.market-browse__detail-btn--back {
  background: transparent;
  color: var(--theme-text-secondary);
}

.market-browse__detail-btn--back:hover {
  background: var(--theme-bg-card);
  color: var(--theme-text-primary);
}

.market-browse__detail-btn--create {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}

.market-browse__detail-btn--create:hover {
  background: var(--theme-primary-hover);
  border-color: var(--theme-primary-hover);
}

.market-browse__detail-trades {
  padding: 0;
}

.market-browse__modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.market-browse__modal {
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  max-width: 28rem;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--theme-space-lg);
}

.market-browse__modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--theme-space-md);
}

.market-browse__modal-header h3 {
  margin: 0;
  font-size: var(--theme-font-lg);
}

.market-browse__modal-close {
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
}
</style>
