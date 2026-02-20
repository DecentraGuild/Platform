<template>
  <div class="trade-list">
    <section class="trade-list__section">
      <h3 class="trade-list__heading">Offered</h3>
      <div class="trade-list__table">
        <div class="trade-list__header">
          <span class="trade-list__cell trade-list__cell--deposit">Deposit</span>
          <span class="trade-list__cell trade-list__cell--requested">Requested</span>
          <span class="trade-list__cell trade-list__cell--unit">Unit price</span>
          <span class="trade-list__cell trade-list__cell--action" />
        </div>
        <div class="trade-list__items">
          <TradeListItem
            v-for="e in offerTrades"
            :key="e.publicKey.toBase58()"
            :escrow="e"
            :escrow-link="escrowLink(e.publicKey.toBase58())"
          />
          <p v-if="!offerTrades.length" class="trade-list__empty">No offers</p>
        </div>
      </div>
    </section>
    <section class="trade-list__section">
      <h3 class="trade-list__heading">Requested</h3>
      <div class="trade-list__table">
        <div class="trade-list__header">
          <span class="trade-list__cell trade-list__cell--deposit">Deposit</span>
          <span class="trade-list__cell trade-list__cell--requested">Requested</span>
          <span class="trade-list__cell trade-list__cell--unit">Unit price</span>
          <span class="trade-list__cell trade-list__cell--action" />
        </div>
        <div class="trade-list__items">
          <TradeListItem
            v-for="e in requestTrades"
            :key="e.publicKey.toBase58()"
            :escrow="e"
            :escrow-link="escrowLink(e.publicKey.toBase58())"
          />
          <p v-if="!requestTrades.length" class="trade-list__empty">No requests</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import TradeListItem from './TradeListItem.vue'
import type { EscrowWithAddress } from '@decentraguild/web3'

defineProps<{
  offerTrades: EscrowWithAddress[]
  requestTrades: EscrowWithAddress[]
  escrowLink: (id: string) => string | { path: string; query?: Record<string, string> }
}>()
</script>

<style scoped>
.trade-list {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  padding: var(--theme-space-sm);
}

.trade-list__section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.trade-list__heading {
  font-size: var(--theme-font-xs);
  font-weight: 600;
  color: var(--theme-text-secondary);
  margin: 0 0 2px;
}

.trade-list__table {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.trade-list__header {
  display: grid;
  grid-template-columns: 1fr 1fr minmax(0, 1fr) 4.25rem;
  gap: var(--theme-space-sm);
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.trade-list__cell--action {
  min-width: 0;
}

.trade-list__items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.trade-list__empty {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  margin: 0;
  padding: var(--theme-space-sm) var(--theme-space-sm);
}
</style>
