<template>
  <Teleport to="body">
    <div v-if="modelValue" class="nft-instance-selector" @click.self="$emit('update:modelValue', false)">
      <div class="nft-instance-selector__panel">
        <div class="nft-instance-selector__header">
          <h3 class="nft-instance-selector__title">{{ collectionName }}</h3>
          <button type="button" class="nft-instance-selector__close" aria-label="Close" @click="$emit('update:modelValue', false)">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <p class="nft-instance-selector__subtitle">Select a specific NFT from the collection</p>
        <div class="nft-instance-selector__toolbar">
          <input
            v-model="searchQuery"
            type="text"
            class="nft-instance-selector__search"
            placeholder="Search by name, number, or mint..."
          />
          <div v-if="hasAnyTraits" class="nft-instance-selector__filters">
            <button
              type="button"
              class="nft-instance-selector__filter-btn"
              :class="{ 'nft-instance-selector__filter-btn--active': filtersOpen }"
              @click="filtersOpen = !filtersOpen"
            >
              <Icon icon="mdi:filter-outline" />
              Filters
              <span v-if="activeFilterCount" class="nft-instance-selector__filter-badge">{{ activeFilterCount }}</span>
            </button>
            <div v-if="filtersOpen" class="nft-instance-selector__filter-panel">
              <div class="nft-instance-selector__filter-header">
                <span>Filter by traits</span>
                <button v-if="hasActiveFilters" type="button" @click="clearTraitFilters">Clear all</button>
              </div>
              <div v-for="(values, traitType) in uniqueTraits" :key="traitType" class="nft-instance-selector__trait-group">
                <p class="nft-instance-selector__trait-label">{{ traitType }}</p>
                <div class="nft-instance-selector__trait-values">
                  <button
                    v-for="val in values"
                    :key="`${traitType}-${val}`"
                    type="button"
                    class="nft-instance-selector__trait-chip"
                    :class="{ 'nft-instance-selector__trait-chip--active': selectedTraits[traitType] === val }"
                    @click="toggleTraitFilter(traitType, val)"
                  >
                    {{ val }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="nft-instance-selector__body">
          <div v-if="loading" class="nft-instance-selector__empty">
            <Icon icon="svg-spinners:ring-resize" class="nft-instance-selector__empty-icon" />
            <p>Loading NFTs...</p>
          </div>
          <div v-else-if="filteredNfts.length === 0" class="nft-instance-selector__empty">
            <Icon icon="mdi:image-off-outline" class="nft-instance-selector__empty-icon" />
            <p>{{ hasActiveFilters ? 'No NFTs match the selected filters' : 'No NFTs found' }}</p>
            <button v-if="hasActiveFilters" type="button" @click="clearSearchAndFilters">Clear filters</button>
          </div>
          <div v-else class="nft-instance-selector__grid">
            <button
              v-for="nft in filteredNfts"
              :key="nft.mint"
              type="button"
              class="nft-instance-selector__card"
              @click="selectNft(nft)"
            >
              <div class="nft-instance-selector__card-media">
                <img v-if="nft.metadata?.image" :src="nft.metadata.image" :alt="nft.metadata.name ?? nft.mint" />
                <div v-else class="nft-instance-selector__card-placeholder">
                  <Icon icon="mdi:image-off" />
                </div>
              </div>
              <div class="nft-instance-selector__card-info">
                <p class="nft-instance-selector__card-name">{{ nft.metadata?.name ?? truncateAddress(nft.mint) }}</p>
                <div v-if="displayTraits(nft).length" class="nft-instance-selector__card-traits">
                  <span
                    v-for="(attr, idx) in displayTraits(nft).slice(0, 3)"
                    :key="idx"
                    class="nft-instance-selector__trait-tag"
                  >
                    {{ attr.trait_type }}: {{ attr.value }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { truncateAddress } from '@decentraguild/display'
import { useMarketplaceAssets } from '~/composables/useMarketplaceAssets'
import {
  filterNFTsBySearch,
  filterNFTsByTraits,
  getUniqueTraits,
  normaliseAttributes,
  type TraitAttribute,
} from '~/utils/nftFilterHelpers'
import type { MarketplaceAsset } from '~/composables/useMarketplaceAssets'

const props = defineProps<{
  modelValue: boolean
  collectionMint: string | null
  collectionName: string
  slug: import('vue').Ref<string | null>
}>()

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; select: [mint: string, name?: string] }>()

const searchQuery = ref('')
const selectedTraits = ref<Record<string, string>>({})
const filtersOpen = ref(false)

const collectionRef = ref<string | null>(props.collectionMint)
watch(
  () => props.collectionMint,
  (v) => { collectionRef.value = v ?? null },
  { immediate: true }
)

const { assets, loading } = useMarketplaceAssets({
  slug: props.slug,
  collection: collectionRef,
  limit: 500,
})

const nfts = computed(() => assets.value)

const uniqueTraits = computed(() => getUniqueTraits(nfts.value))
const hasAnyTraits = computed(() => Object.keys(uniqueTraits.value).length > 0)
const hasActiveFilters = computed(() => Object.keys(selectedTraits.value).length > 0)
const activeFilterCount = computed(() => Object.keys(selectedTraits.value).length)

const afterSearch = computed(() => filterNFTsBySearch(nfts.value, searchQuery.value))
const filteredNfts = computed(() => filterNFTsByTraits(afterSearch.value, selectedTraits.value))

function displayTraits(nft: MarketplaceAsset): TraitAttribute[] {
  return normaliseAttributes(nft.metadata?.traits ?? [])
}

function toggleTraitFilter(traitType: string, value: string) {
  const next = { ...selectedTraits.value }
  if (next[traitType] === value) delete next[traitType]
  else next[traitType] = value
  selectedTraits.value = next
}

function clearTraitFilters() {
  selectedTraits.value = {}
}

function clearSearchAndFilters() {
  searchQuery.value = ''
  selectedTraits.value = {}
  filtersOpen.value = false
}

function selectNft(nft: MarketplaceAsset) {
  emit('select', nft.mint, nft.metadata?.name ?? undefined)
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      searchQuery.value = ''
      selectedTraits.value = {}
      filtersOpen.value = false
    }
  }
)
</script>

<style scoped>
.nft-instance-selector {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.nft-instance-selector__panel {
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  max-width: min(95vw, 48rem);
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nft-instance-selector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-md) var(--theme-space-lg);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.nft-instance-selector__title {
  margin: 0;
  font-size: var(--theme-font-lg);
}

.nft-instance-selector__close {
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
}

.nft-instance-selector__subtitle {
  padding: 0 var(--theme-space-lg);
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.nft-instance-selector__toolbar {
  display: flex;
  gap: var(--theme-space-sm);
  padding: var(--theme-space-md) var(--theme-space-lg);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.nft-instance-selector__search {
  flex: 1;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.nft-instance-selector__filters {
  position: relative;
}

.nft-instance-selector__filter-btn {
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

.nft-instance-selector__filter-btn--active {
  border-color: var(--theme-primary);
}

.nft-instance-selector__filter-badge {
  min-width: 1.25rem;
  padding: 0 4px;
  font-size: var(--theme-font-xs);
  background: var(--theme-primary);
  color: white;
  border-radius: 999px;
}

.nft-instance-selector__filter-panel {
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

.nft-instance-selector__filter-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.nft-instance-selector__trait-group {
  margin-bottom: var(--theme-space-sm);
}

.nft-instance-selector__trait-label {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.nft-instance-selector__trait-values {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.nft-instance-selector__trait-chip {
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.nft-instance-selector__trait-chip--active {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}

.nft-instance-selector__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--theme-space-lg);
}

.nft-instance-selector__empty {
  text-align: center;
  padding: var(--theme-space-xl);
  color: var(--theme-text-muted);
}

.nft-instance-selector__empty-icon {
  font-size: 2rem;
  margin-bottom: var(--theme-space-sm);
}

.nft-instance-selector__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: var(--theme-space-md);
}

.nft-instance-selector__card {
  text-align: left;
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  overflow: hidden;
  background: var(--theme-bg-card);
  cursor: pointer;
  transition: border-color 0.15s;
}

.nft-instance-selector__card:hover {
  border-color: var(--theme-primary);
}

.nft-instance-selector__card-media {
  aspect-ratio: 1;
  overflow: hidden;
}

.nft-instance-selector__card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nft-instance-selector__card-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-text-muted);
}

.nft-instance-selector__card-info {
  padding: var(--theme-space-sm);
}

.nft-instance-selector__card-name {
  margin: 0;
  font-size: var(--theme-font-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nft-instance-selector__card-traits {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
  margin-top: var(--theme-space-xs);
}

.nft-instance-selector__trait-tag {
  font-size: var(--theme-font-xs);
  padding: 2px 6px;
  background: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-muted);
}
</style>
