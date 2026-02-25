<template>
  <div>
    <div class="market-browse-grid__toolbar">
      <span class="market-browse-grid__scale-label">Card size</span>
      <div class="market-browse-grid__scale">
        <input
          :model-value="gridScaleRem"
          type="range"
          min="14"
          max="25"
          step="1"
          class="market-browse-grid__scale-slider"
          aria-label="Grid card size"
          @input="onScaleInput"
        />
        <span class="market-browse-grid__scale-value">{{ gridScaleRem }}rem</span>
      </div>
    </div>
    <div class="market-browse-grid__grid" :style="gridStyle">
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
        :traits="normalisedTraits(asset)"
        @select="onSelect(asset)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AssetCard from './AssetCard.vue'
import { normaliseAttributes } from '~/utils/nftFilterHelpers'
import type { AssetWithCounts } from '~/composables/useAssetWithCounts'

const props = withDefaults(
  defineProps<{
    assetCards: AssetWithCounts[]
    gridScaleRem: number
    getDisplaySymbol: (asset: AssetWithCounts) => string | null
  }>(),
  {}
)

const emit = defineEmits<{
  select: [payload: { mint: string; assetType: string; collectionMint?: string | null }]
  'update:gridScaleRem': [value: number]
}>()

const gridStyle = computed(() => ({ '--market-grid-min': `${props.gridScaleRem}rem` }))

function onScaleInput(e: Event) {
  const target = e.target as HTMLInputElement
  const n = target?.value != null ? parseInt(target.value, 10) : NaN
  if (Number.isFinite(n) && n >= 14 && n <= 25) {
    emit('update:gridScaleRem', n)
  }
}

function normalisedTraits(asset: AssetWithCounts) {
  return normaliseAttributes(asset.metadata?.traits ?? [])
}

function onSelect(asset: AssetWithCounts) {
  emit('select', {
    mint: asset.mint,
    assetType: asset.assetType,
    collectionMint: asset.collectionMint ?? undefined,
  })
}
</script>

<style scoped>
.market-browse-grid__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-sm);
}

.market-browse-grid__scale-label {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.market-browse-grid__scale {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
}

.market-browse-grid__scale-slider {
  width: 6rem;
  accent-color: var(--theme-primary);
}

.market-browse-grid__scale-value {
  font-size: var(--theme-font-xs);
  font-family: ui-monospace, monospace;
  color: var(--theme-text-muted);
  min-width: 2.5rem;
}

.market-browse-grid__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--market-grid-min, 10rem), 1fr));
  gap: var(--theme-space-sm);
}
</style>
