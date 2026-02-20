<template>
  <div class="trade-list-item">
    <template v-if="display">
      <div class="trade-list-item__cell trade-list-item__cell--deposit">
        <TokenAmountWithLabel
          :amount="display.depositAmount"
          :decimals="display.depositDecimals"
          :symbol="display.depositSymbol"
          :name="display.depositName"
          :mint="depositMint"
          :show-mint-short="false"
        />
      </div>
      <div class="trade-list-item__cell trade-list-item__cell--requested">
        <span class="trade-list-item__requested">
          {{ requestedDisplay }}
          <span class="trade-list-item__requested-label">{{ requestedLabel }}</span>
        </span>
      </div>
      <div class="trade-list-item__cell trade-list-item__cell--unit">
        <span class="trade-list-item__unit-price">{{ unitPriceLabel }}</span>
        <button
          type="button"
          class="trade-list-item__flip"
          aria-label="Flip unit price"
          @click="flipped = !flipped"
        >
          <Icon icon="mdi:swap-horizontal" />
        </button>
      </div>
      <div class="trade-list-item__cell trade-list-item__cell--action">
        <NuxtLink :to="escrowLink" class="trade-list-item__fill">
          <span class="trade-list-item__fill-line">Fill</span>
          <span class="trade-list-item__fill-line">{{ escrow.account.allowPartialFill ? 'Partial' : 'Full' }}</span>
        </NuxtLink>
      </div>
    </template>
    <span v-else class="trade-list-item__fallback">Loading...</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { Icon } from '@iconify/vue'
import { TokenAmountWithLabel } from '@decentraguild/ui/components'
import { sanitizeTokenLabel } from '@decentraguild/display'
import type { EscrowWithAddress } from '@decentraguild/web3'
import { useEscrowDisplay } from '~/composables/useEscrowDisplay'

const props = defineProps<{
  escrow: EscrowWithAddress
  escrowLink: string | { path: string; query?: Record<string, string> }
}>()

const escrowRef = toRef(props, 'escrow')
const { data } = useEscrowDisplay(escrowRef)

const flipped = ref(false)

const display = computed(() => data.value)
const depositMint = computed(() => props.escrow?.account.depositToken.toBase58() ?? '')
const requestMint = computed(() => props.escrow?.account.requestToken.toBase58() ?? '')

/** Human requested amount from display (deposit converted with deposit decimals, then * price). No raw units. */
const requestedDisplay = computed(() => {
  const d = display.value
  if (!d || !Number.isFinite(d.requestAmount)) return '–'
  const n = d.requestAmount
  return Number.isInteger(n) ? String(n) : n.toFixed(6).replace(/\.?0+$/, '')
})

const requestedLabel = computed(() => {
  const d = display.value
  if (!d) return ''
  return sanitizeTokenLabel(d.priceSymbol || d.requestName) || ''
})

const unitPriceLabel = computed(() => {
  const d = display.value
  if (!d) return ''
  const price = d.pricePerUnit ?? 0
  const depSym = sanitizeTokenLabel(d.depositSymbol || d.depositName) || 'deposit'
  const reqSym = sanitizeTokenLabel(d.priceSymbol || d.requestName) || 'request'
  if (!price || !Number.isFinite(price)) return '–'
  if (flipped.value) {
    const inv = 1 / price
    const invStr = !Number.isFinite(inv) ? '–' : Number.isInteger(inv) ? String(inv) : inv.toFixed(6).replace(/\.?0+$/, '')
    return `1 ${reqSym} = ${invStr} ${depSym}`
  }
  return `1 ${depSym} = ${price} ${reqSym}`
})
</script>

<style scoped>
.trade-list-item {
  display: grid;
  grid-template-columns: 1fr 1fr minmax(0, 1fr) 4.25rem;
  gap: var(--theme-space-sm);
  align-items: center;
  padding: 3px var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-top: none;
}

.trade-list-item:first-of-type {
  border-top: var(--theme-border-thin) solid var(--theme-border);
}

.trade-list-item__cell {
  min-width: 0;
}

.trade-list-item__cell--unit {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
}

.trade-list-item__unit-price {
  color: var(--theme-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trade-list-item__requested {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25em;
  font-weight: 600;
  color: var(--theme-text-primary);
}

.trade-list-item__requested-label {
  font-weight: 400;
  color: var(--theme-text-secondary);
}

.trade-list-item__flip {
  flex-shrink: 0;
  display: inline-flex;
  padding: 2px;
  background: none;
  border: none;
  color: var(--theme-text-muted);
  cursor: pointer;
  font-size: 1rem;
}

.trade-list-item__flip:hover {
  color: var(--theme-text-primary);
}

.trade-list-item__fill {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 4.25rem;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  font-weight: 500;
  color: white;
  background: var(--theme-primary);
  border: var(--theme-border-thin) solid var(--theme-primary);
  border-radius: var(--theme-radius-sm);
  text-decoration: none;
  transition: background-color 0.15s, border-color 0.15s;
  box-sizing: border-box;
}

.trade-list-item__fill:hover {
  background: var(--theme-primary-hover);
  border-color: var(--theme-primary-hover);
  color: white;
}

.trade-list-item__fill-line {
  display: block;
  line-height: 1.2;
}

.trade-list-item__fallback {
  grid-column: 1 / -1;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  color: var(--theme-text-muted);
  font-size: var(--theme-font-sm);
}
</style>
