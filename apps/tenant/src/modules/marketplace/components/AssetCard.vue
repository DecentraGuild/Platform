<template>
  <component
    :is="linkTo ? NuxtLink : 'button'"
    :to="linkTo"
    type="button"
    class="asset-card"
    @click="!linkTo && $emit('select', { mint, assetType, collectionMint: collectionMint ?? undefined })"
  >
    <div class="asset-card__media">
      <img
        v-if="image"
        :src="image"
        :alt="name"
        class="asset-card__img"
        loading="lazy"
      />
      <div v-else class="asset-card__placeholder">
        <Icon icon="mdi:image-off" class="asset-card__placeholder-icon" />
      </div>
    </div>
    <div class="asset-card__body">
      <span class="asset-card__name">{{ name || truncateAddress(mint) }}</span>
      <span class="asset-card__symbol">{{ symbol ?? '—' }}</span>
      <span class="asset-card__mint">{{ truncateAddress(mint) }}</span>
    </div>
    <div class="asset-card__open-trades">
      <span v-if="(offerCount ?? 0) > 0" class="asset-card__count asset-card__count--offer">{{ offerCount }} offered</span>
      <span v-if="(requestCount ?? 0) > 0" class="asset-card__count asset-card__count--request">{{ requestCount }} requested</span>
      <span v-if="(offerCount ?? 0) === 0 && (requestCount ?? 0) === 0" class="asset-card__count asset-card__count--muted">No trades</span>
    </div>
  </component>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { truncateAddress } from '@decentraguild/display'
import type { AssetType } from '../../../composables/useMarketplaceAssets'

defineProps<{
  mint: string
  assetType: AssetType
  name?: string | null
  symbol?: string | null
  image?: string | null
  offerCount?: number
  requestCount?: number
  /** When provided, card navigates on click. When omitted, card emits @select. */
  linkTo?: string | { path: string; query?: Record<string, string> }
  collectionMint?: string | null
}>()

defineEmits<{
  select: [{ mint: string; assetType: AssetType; collectionMint?: string | null }]
}>()

</script>

<style scoped>
.asset-card {
  display: flex;
  flex-direction: column;
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  overflow: hidden;
  text-decoration: none;
  color: var(--theme-text-primary);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.asset-card:hover {
  border-color: var(--theme-primary);
  box-shadow: var(--theme-shadow-glow, 0 0 20px rgba(0, 149, 26, 0.2));
}

.asset-card__media {
  aspect-ratio: 1;
  background: var(--theme-bg-secondary);
  overflow: hidden;
}

.asset-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--theme-text-muted);
}

.asset-card__placeholder-icon {
  font-size: 1.25rem;
}

.asset-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--theme-space-xs);
  flex: 1;
  min-height: 0;
}

.asset-card__open-trades {
  display: flex;
  gap: var(--theme-space-xs);
  flex-wrap: wrap;
  font-size: var(--theme-font-xs);
  padding: var(--theme-space-xs);
  border-top: var(--theme-border-thin) solid var(--theme-border);
  background: var(--theme-bg-secondary);
  margin-top: auto;
}

.asset-card__name {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  color: var(--theme-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-card__symbol {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.asset-card__mint {
  font-size: var(--theme-font-xs);
  font-family: ui-monospace, monospace;
  color: var(--theme-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-card__count--offer {
  color: var(--theme-trade-buy);
}

.asset-card__count--request {
  color: var(--theme-trade-sell);
}

.asset-card__count--muted {
  color: var(--theme-text-muted);
}
</style>
