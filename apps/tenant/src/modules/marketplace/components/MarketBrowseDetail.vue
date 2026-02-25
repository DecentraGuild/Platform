<template>
  <div class="market-browse-detail">
    <div class="market-browse-detail__meta">
      <div class="market-browse-detail__media">
        <img
          v-if="detailAsset?.metadata?.image"
          :src="detailAsset.metadata.image"
          :alt="detailAsset.metadata.name ?? detailMint"
          class="market-browse-detail__img"
        />
        <div v-else class="market-browse-detail__placeholder">
          <Icon icon="mdi:image-off" />
        </div>
      </div>
      <div class="market-browse-detail__info">
        <div class="market-browse-detail__info-text">
          <h2 class="market-browse-detail__name">{{ detailAsset?.metadata?.name ?? truncateAddress(detailMint) }}</h2>
          <div class="market-browse-detail__ticker-row">
            <span v-if="detailAsset?.metadata?.symbol" class="market-browse-detail__symbol">{{ detailAsset.metadata.symbol }}</span>
            <button
              type="button"
              class="market-browse-detail__icon-btn"
              aria-label="Copy address"
              @click="$emit('copy-address')"
            >
              <Icon icon="mdi:content-copy" />
            </button>
            <a
              :href="solscanTokenUrl"
              target="_blank"
              rel="noopener"
              class="market-browse-detail__icon-btn market-browse-detail__solscan"
              aria-label="Jump to Solscan"
            >
              <Icon icon="mdi:open-in-new" />
            </a>
          </div>
          <code class="market-browse-detail__address">{{ detailMint }}</code>
          <div v-if="detailTraits.length" class="market-browse-detail__traits">
            <p class="market-browse-detail__traits-label">Traits</p>
            <div class="market-browse-detail__traits-list">
              <span
                v-for="(attr, idx) in detailTraits"
                :key="idx"
                class="market-browse-detail__trait-tag"
              >
                {{ attr.trait_type }}: {{ attr.value }}
              </span>
            </div>
          </div>
        </div>
        <div class="market-browse-detail__actions">
          <button type="button" class="market-browse-detail__btn market-browse-detail__btn--back" @click="$emit('back')">
            <Icon icon="mdi:arrow-left" class="market-browse-detail__btn-icon" />
            <span class="market-browse-detail__btn-label">Back</span>
          </button>
          <button
            type="button"
            class="market-browse-detail__btn market-browse-detail__btn--create"
            :class="{ 'market-browse-detail__btn--disabled': createDisabled }"
            :disabled="createDisabled"
            @click="!createDisabled && $emit('open-create-trade')"
          >
            <Icon icon="mdi:plus" class="market-browse-detail__btn-icon" />
            <span class="market-browse-detail__btn-label">Create</span>
          </button>
        </div>
      </div>
    </div>
    <div class="market-browse-detail__trades">
      <TradeList
        :offer-trades="detailTrades.offerTrades"
        :request-trades="detailTrades.requestTrades"
        :escrow-link="escrowLink"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { truncateAddress } from '@decentraguild/display'
import TradeList from './TradeList.vue'
import type { EscrowWithAddress } from '@decentraguild/web3'
import type { TraitAttribute } from '~/utils/nftFilterHelpers'

defineProps<{
  detailMint: string
  detailAsset: {
    metadata?: {
      name?: string | null
      symbol?: string | null
      image?: string | null
      traits?: unknown
    } | null
  } | null
  detailTraits: TraitAttribute[]
  detailTrades: { offerTrades: EscrowWithAddress[]; requestTrades: EscrowWithAddress[] }
  solscanTokenUrl: string
  createDisabled?: boolean
  escrowLink: (id: string) => string | { path: string; query?: Record<string, string> }
}>()

defineEmits<{
  back: []
  'open-create-trade': []
  'copy-address': []
}>()
</script>

<style scoped>
.market-browse-detail {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: var(--theme-space-xl);
}

@media (max-width: var(--theme-breakpoint-md)) {
  .market-browse-detail {
    grid-template-columns: 1fr;
  }
}

.market-browse-detail__meta {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.market-browse-detail__info {
  display: flex;
  align-items: flex-start;
  gap: var(--theme-space-md);
}

.market-browse-detail__info-text {
  flex: 1;
  min-width: 0;
}

.market-browse-detail__media {
  aspect-ratio: 1;
  background: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-lg);
  overflow: hidden;
}

.market-browse-detail__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.market-browse-detail__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--theme-text-muted);
}

.market-browse-detail__name {
  font-size: var(--theme-font-xl);
  font-weight: 600;
  margin: 0;
}

.market-browse-detail__ticker-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--theme-space-xs);
  margin: 0;
  min-width: 0;
}

.market-browse-detail__ticker-row .market-browse-detail__symbol {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin: 0;
  flex-shrink: 0;
}

.market-browse-detail__ticker-row .market-browse-detail__icon-btn {
  flex-shrink: 0;
}

.market-browse-detail__address {
  display: block;
  margin: var(--theme-space-xs) 0 0;
  font-size: var(--theme-font-xs);
  font-family: ui-monospace, monospace;
  word-break: break-all;
  color: var(--theme-text-secondary);
}

.market-browse-detail__icon-btn {
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

.market-browse-detail__icon-btn:hover {
  color: var(--theme-text-primary);
}

.market-browse-detail__traits {
  margin-top: var(--theme-space-sm);
}

.market-browse-detail__traits-label {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.market-browse-detail__traits-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.market-browse-detail__trait-tag {
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
}

.market-browse-detail__actions {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
  flex-shrink: 0;
}

.market-browse-detail__btn {
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

.market-browse-detail__btn-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.market-browse-detail__btn-label {
  font-size: 10px;
  line-height: 1;
}

.market-browse-detail__btn--back {
  background: transparent;
  color: var(--theme-text-secondary);
}

.market-browse-detail__btn--back:hover {
  background: var(--theme-bg-card);
  color: var(--theme-text-primary);
}

.market-browse-detail__btn--create {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}

.market-browse-detail__btn--create:hover:not(:disabled) {
  background: var(--theme-primary-hover);
  border-color: var(--theme-primary-hover);
}

.market-browse-detail__btn--create.market-browse-detail__btn--disabled,
.market-browse-detail__btn--create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-muted);
  border-color: var(--theme-border);
}

.market-browse-detail__trades {
  padding: 0;
}
</style>
