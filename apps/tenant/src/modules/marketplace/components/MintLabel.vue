<template>
  <span class="mint-label">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { toRef, computed } from 'vue'
import { sanitizeTokenLabel } from '@decentraguild/display'
import { useTokenDisplay } from '~/composables/useTokenDisplay'

const props = defineProps<{ mint: string }>()

const mintRef = toRef(props, 'mint')
const { data } = useTokenDisplay(mintRef, undefined)

const label = computed(() => {
  const d = data.value
  const name = sanitizeTokenLabel(d?.name ?? null)
  const symbol = sanitizeTokenLabel(d?.symbol ?? null)
  if (name) return name
  if (symbol) return symbol
  return d?.mintShort ?? props.mint.slice(0, 8) + '...'
})
</script>

<style scoped>
.mint-label {
  font-weight: 500;
  color: var(--theme-text-primary);
}
</style>
