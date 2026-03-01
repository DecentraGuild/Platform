<template>
  <div v-if="entry" class="doc-module-summary">
    <div class="doc-module-summary__header">
      <h2 class="doc-module-summary__name">{{ entry.name }}</h2>
      <p class="doc-module-summary__desc">{{ entry.shortDescription }}</p>
    </div>
    <ul v-if="entry.keyInfo?.length" class="doc-module-summary__key-info">
      <li v-for="(item, i) in entry.keyInfo" :key="i">{{ item }}</li>
    </ul>
    <div v-if="pricingSummary" class="doc-module-summary__pricing">
      <h3 class="doc-module-summary__pricing-title">Pricing</h3>
      <p class="doc-module-summary__pricing-text">{{ pricingSummary }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getModuleCatalogEntry } from '@decentraguild/config'

const props = defineProps<{ moduleId: string }>()

const entry = computed(() => getModuleCatalogEntry(props.moduleId))

const pricingSummary = computed(() => {
  const p = entry.value?.pricing
  if (!p) return null
  if (p.modelType === 'flat_one_time') {
    return `One-time: ${formatUsdc(p.amount)} USDC`
  }
  if (p.modelType === 'flat_recurring') {
    return `Recurring: ${formatUsdc(p.recurringYearly)} USDC/yr`
  }
  if (p.modelType === 'tiered_addons' && p.tiers?.length) {
    const tierNames = p.tiers.map((t) => t.name).join(', ')
    const prices = p.tiers.map((t) => `${t.name}: ${formatUsdc(t.recurringPrice)} USDC/mo`).join('; ')
    return `${tierNames}. ${prices}${p.yearlyDiscountPercent ? ` (${p.yearlyDiscountPercent}% off yearly)` : ''}`
  }
  return null
})

function formatUsdc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}
</script>

<style scoped>
.doc-module-summary {
  padding: var(--theme-space-lg);
  margin-bottom: var(--theme-space-xl);
  background-color: var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  border-radius: 8px;
}

.doc-module-summary__header {
  margin-bottom: var(--theme-space-md);
}

.doc-module-summary__name {
  font-size: var(--theme-font-xl);
  font-weight: 600;
  margin: 0 0 var(--theme-space-xs);
  color: var(--theme-text-primary);
}

.doc-module-summary__desc {
  font-size: var(--theme-font-base);
  margin: 0;
  color: var(--theme-text-secondary);
  line-height: 1.5;
}

.doc-module-summary__key-info {
  margin: 0 0 var(--theme-space-md);
  padding-left: var(--theme-space-lg);
  color: var(--theme-text-secondary);
  font-size: var(--theme-font-sm);
}

.doc-module-summary__key-info li {
  margin-bottom: var(--theme-space-xs);
}

.doc-module-summary__pricing {
  padding-top: var(--theme-space-md);
  border-top: 1px solid var(--theme-border);
}

.doc-module-summary__pricing-title {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  margin: 0 0 var(--theme-space-xs);
  color: var(--theme-text-muted);
}

.doc-module-summary__pricing-text {
  font-size: var(--theme-font-sm);
  margin: 0;
  color: var(--theme-text-secondary);
}
</style>
