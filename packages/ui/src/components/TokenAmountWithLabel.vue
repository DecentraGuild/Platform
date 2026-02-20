<template>
  <span class="token-amount">
    <span class="token-amount__value">{{ formattedAmount }}</span>
    <span class="token-amount__label">
      {{ displayLabel }}
    </span>
    <span v-if="showMintShort && (symbol || name)" class="token-amount__mint">
      ({{ mintShort }})
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { sanitizeTokenLabel, truncateAddress } from '@decentraguild/display'

const props = withDefaults(
  defineProps<{
    amount: number
    decimals?: number | null
    symbol?: string | null
    name?: string | null
    mint: string
    showMintShort?: boolean
  }>(),
  { decimals: 0, showMintShort: false }
)

/** Raw number for display until a new formatter is added. No K/M, no decimal rules. */
function rawAmountString(amount: number): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '0'
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(6).replace(/\.?0+$/, '')
}

const formattedAmount = computed(() => rawAmountString(props.amount))
const mintShort = computed(() => truncateAddress(props.mint, 6, 4))
const displayLabel = computed(() => {
  const dec = props.decimals ?? 0
  const symbol = sanitizeTokenLabel(props.symbol)
  const name = sanitizeTokenLabel(props.name)
  if (dec === 0) return name || symbol || mintShort.value
  return symbol || name || mintShort.value
})
</script>

<style scoped>
.token-amount {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25em;
}

.token-amount__value {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.token-amount__label {
  color: var(--theme-text-secondary);
}

.token-amount__mint {
  font-size: var(--theme-font-xs);
  font-family: ui-monospace, monospace;
  color: var(--theme-text-muted);
}
</style>
