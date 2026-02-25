<template>
  <div class="market-browse-toolbar">
    <input
      :value="searchQuery"
      type="text"
      class="market-browse-toolbar__search"
      placeholder="Search by name, number, or mint..."
      @input="onSearchInput"
    />
    <div class="market-browse-toolbar__filters">
      <button
        type="button"
        class="market-browse-toolbar__filter-btn"
        :class="{ 'market-browse-toolbar__filter-btn--active': filtersOpen }"
        @click="toggleFiltersOpen"
      >
        <Icon icon="mdi:filter-outline" />
        Filters
        <span v-if="activeFilterCount" class="market-browse-toolbar__filter-badge">{{ activeFilterCount }}</span>
      </button>
      <div v-if="filtersOpen" class="market-browse-toolbar__filter-panel">
        <div class="market-browse-toolbar__filter-header">
          <span>Filter by traits</span>
          <button v-if="activeFilterCount" type="button" @click="clearFilters">Clear all</button>
        </div>
        <div v-for="(values, traitType) in uniqueTraits" :key="traitType" class="market-browse-toolbar__trait-group">
          <p class="market-browse-toolbar__trait-label">{{ traitType }}</p>
          <div class="market-browse-toolbar__trait-values">
            <button
              v-for="val in values"
              :key="`${traitType}-${val}`"
              type="button"
              class="market-browse-toolbar__trait-chip"
              :class="{ 'market-browse-toolbar__trait-chip--active': selectedTraits[traitType] === val }"
              @click="onToggleFilter(traitType, val)"
            >
              {{ val }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  searchQuery: string
  selectedTraits: Record<string, string>
  filtersOpen: boolean
  uniqueTraits: Record<string, string[]>
  activeFilterCount: number
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:filtersOpen': [value: boolean]
  toggleFilter: [traitType: string, value: string]
  clearFilters: []
}>()

function onSearchInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:searchQuery', target?.value ?? '')
}

function toggleFiltersOpen() {
  emit('update:filtersOpen', !props.filtersOpen)
}

function onToggleFilter(traitType: string, value: string) {
  emit('toggleFilter', traitType, value)
}

function clearFilters() {
  emit('clearFilters')
}
</script>

<style scoped>
.market-browse-toolbar {
  display: flex;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-md);
}

.market-browse-toolbar__search {
  flex: 1;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.market-browse-toolbar__filters {
  position: relative;
}

.market-browse-toolbar__filter-btn {
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

.market-browse-toolbar__filter-btn--active {
  border-color: var(--theme-primary);
}

.market-browse-toolbar__filter-badge {
  min-width: 1.25rem;
  padding: 0 4px;
  font-size: var(--theme-font-xs);
  background: var(--theme-primary);
  color: white;
  border-radius: 999px;
}

.market-browse-toolbar__filter-panel {
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

.market-browse-toolbar__filter-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.market-browse-toolbar__trait-group {
  margin-bottom: var(--theme-space-sm);
}

.market-browse-toolbar__trait-label {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.market-browse-toolbar__trait-values {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.market-browse-toolbar__trait-chip {
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.market-browse-toolbar__trait-chip--active {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}
</style>
