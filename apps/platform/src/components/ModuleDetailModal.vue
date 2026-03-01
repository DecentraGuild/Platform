<template>
  <Modal
    :model-value="!!entry"
    :title="entry?.name ?? ''"
    @update:model-value="$emit('close')"
  >
    <div v-if="entry" class="module-detail">
      <p class="module-detail__desc">{{ entry.shortDescription }}</p>
      <ul v-if="entry.keyInfo?.length" class="module-detail__key-info">
        <li v-for="(item, i) in entry.keyInfo" :key="i">{{ item }}</li>
      </ul>
      <div v-if="fromPrice" class="module-detail__pricing">
        <span class="module-detail__pricing-label">From</span>
        {{ fromPrice }}
      </div>
      <span v-else-if="entry.status === 'coming_soon'" class="module-detail__coming-soon">Coming soon</span>
      <a
        :href="docsUrl"
        target="_blank"
        rel="noopener"
        class="module-detail__learn-more"
      >
        Learn more
        <Icon icon="mdi:open-in-new" class="module-detail__learn-more-icon" />
      </a>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Modal } from '@decentraguild/ui/components'
import type { ModuleCatalogEntry } from '@decentraguild/config'
import type { PricingModel } from '@decentraguild/billing'

const props = defineProps<{
  entry: ModuleCatalogEntry | null
}>()

defineEmits<{
  close: []
}>()

const config = useRuntimeConfig()
const platformDocsBase = (config.public.platformDocsUrl as string) ?? 'https://dguild.org/docs'
const docsUrl = computed(() =>
  props.entry
    ? `${platformDocsBase.replace(/\/$/, '')}/modules/${props.entry.id}`
    : ''
)

function formatUsdc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function getFromPrice(p: PricingModel): string | null {
  if (p.modelType === 'flat_one_time') {
    return `${formatUsdc(p.amount)} USDC one-time`
  }
  if (p.modelType === 'flat_recurring') {
    const yearly = p.recurringYearly ?? (p.recurringPrice ?? 0) * 12
    return `From ${formatUsdc(yearly)} USDC/yr`
  }
  if (p.modelType === 'tiered_addons' && p.tiers?.length) {
    const minPrice = Math.min(...p.tiers.map((t) => t.recurringPrice))
    return `From ${formatUsdc(minPrice)} USDC/mo`
  }
  return null
}

const fromPrice = computed(() => {
  const p = props.entry?.pricing
  return p ? getFromPrice(p) : null
})
</script>

<style scoped>
.module-detail {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.module-detail__desc {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.module-detail__key-info {
  margin: 0;
  padding-left: var(--theme-space-lg);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.module-detail__key-info li {
  margin-bottom: var(--theme-space-xs);
}

.module-detail__pricing,
.module-detail__coming-soon {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  color: var(--theme-primary);
}

.module-detail__pricing-label {
  font-weight: 400;
  color: var(--theme-text-muted);
  margin-right: var(--theme-space-xs);
}

.module-detail__learn-more {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
  font-size: var(--theme-font-sm);
  color: var(--theme-primary);
  text-decoration: none;
}

.module-detail__learn-more:hover {
  color: var(--theme-primary-hover);
}

.module-detail__learn-more-icon {
  font-size: 0.875rem;
}
</style>
