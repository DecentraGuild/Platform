<template>
  <PageSection>
    <div class="modules">
      <div class="modules__intro">
        <DguildCenter />
      </div>

      <section class="modules__section" aria-label="Module list">
        <h2 class="modules__heading">Modules</h2>
        <div class="modules__grid">
          <div
            v-for="entry in displayModules"
            :key="entry.id"
            class="modules__card"
            :class="{ 'modules__card--expanded': expandedModuleId === entry.id }"
          >
            <span class="modules__card-bg-icon" aria-hidden="true">
              <Icon :icon="entry.icon" height="none" class="modules__card-bg-icon-svg" />
            </span>
            <button
              type="button"
              class="modules__card-trigger"
              :aria-expanded="expandedModuleId === entry.id"
              :aria-controls="`module-detail-${entry.id}`"
              :id="`module-trigger-${entry.id}`"
              @click="toggleModule(entry.id)"
            >
              <span class="modules__card-header">
                <span class="modules__card-heading">
                  <span class="modules__card-name-row">
                    <span class="modules__card-name">{{ entry.name }}</span>
                    <span v-if="entry.status === 'coming_soon'" class="modules__card-badge">Coming soon</span>
                  </span>
                  <span v-if="getFromPrice(entry)" class="modules__card-pill">
                    From {{ getFromPrice(entry) }}
                  </span>
                </span>
              </span>
              <p v-if="entry.shortDescription && expandedModuleId !== entry.id" class="modules__card-preview">
                {{ entry.shortDescription }}
              </p>
              <span class="modules__card-chevron" aria-hidden="true">
                <Icon icon="mdi:chevron-down" class="modules__card-chevron-icon" />
              </span>
            </button>

            <div
              :id="`module-detail-${entry.id}`"
              class="modules__card-detail"
              role="region"
              :aria-labelledby="`module-trigger-${entry.id}`"
              :hidden="expandedModuleId !== entry.id"
            >
              <p class="modules__card-desc">
                {{ entry.detailedDescription || entry.longDescription || entry.shortDescription }}
              </p>
              <ul v-if="entry.keyInfo?.length" class="modules__card-key-info">
                <li v-for="(item, i) in entry.keyInfo" :key="i">{{ item }}</li>
              </ul>
              <div v-if="getFromPrice(entry)" class="modules__card-pricing">
                <span class="modules__card-pricing-label">From</span>
                {{ getFromPrice(entry) }}
              </div>
              <p v-else-if="entry.status === 'coming_soon'" class="modules__card-coming-soon">Coming soon</p>
              <a
                :href="docsUrl(entry)"
                target="_blank"
                rel="noopener"
                class="modules__card-learn-more"
                @click.stop
              >
                Learn more
                <Icon icon="mdi:open-in-new" class="modules__card-learn-more-icon" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
definePageMeta({ title: 'Modules' })
import { Icon } from '@iconify/vue'
import { PageSection } from '@decentraguild/ui/components'
import { getModuleCatalogList } from '@decentraguild/config'
import type { ModuleCatalogEntry } from '@decentraguild/config'
import type { PricingModel } from '@decentraguild/billing'
import DguildCenter from '~/components/DguildCenter.vue'

const config = useRuntimeConfig()
const platformDocsBase = (config.public.platformDocsUrl as string) ?? 'https://dguild.org/docs'

const expandedModuleId = ref<string | null>(null)

function toggleModule(id: string) {
  expandedModuleId.value = expandedModuleId.value === id ? null : id
}

function docsUrl(entry: ModuleCatalogEntry) {
  return `${platformDocsBase.replace(/\/$/, '')}/modules/${entry.id}`
}

function formatUsdc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function getFromPrice(entry: ModuleCatalogEntry): string | null {
  const p = entry.pricing
  if (!p) return null
  if (p.modelType === 'flat_one_time') {
    return `${formatUsdc(p.amount)} USDC one-time`
  }
  if (p.modelType === 'flat_recurring') {
    const yearly = p.recurringYearly ?? (p.recurringPrice ?? 0) * 12
    return `${formatUsdc(yearly)} USDC/yr`
  }
  if (p.modelType === 'tiered_addons' && p.tiers?.length) {
    const minPrice = Math.min(...p.tiers.map((t) => t.recurringPrice))
    return `${formatUsdc(minPrice)} USDC/mo`
  }
  if (p.modelType === 'tiered_with_one_time_per_unit' && p.tiers?.length) {
    const baseTier = p.tiers[0]
    const unitLabel = (p.oneTimeUnitName ?? 'unit').toLowerCase()
    if (baseTier.oneTimePerUnit) {
      return `${formatUsdc(baseTier.oneTimePerUnit)} USDC ${unitLabel}`
    }
    if (baseTier.recurringPrice) {
      return `${formatUsdc(baseTier.recurringPrice)} USDC/mo`
    }
    return null
  }
  if (p.modelType === 'add_unit') {
    const isWhitelist = p.conditionKey === 'listsCount'
    const unitLabel = isWhitelist ? 'per list' : 'per unit'
    if (p.pricePerUnit) {
      return `${formatUsdc(p.pricePerUnit)} USDC ${unitLabel}`
    }
    return null
  }
  return null
}

const DISPLAY_STATUSES = new Set<'available' | 'coming_soon'>(['available', 'coming_soon'])

const displayModules = computed(() =>
  getModuleCatalogList().filter((m) => DISPLAY_STATUSES.has(m.status as 'available' | 'coming_soon'))
)
</script>

<style scoped>
.modules {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xl);
  padding-bottom: var(--theme-space-lg);
}

.modules__intro {
  flex-shrink: 0;
}

.modules__section {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.modules__heading {
  margin: 0;
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
}

.modules__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--theme-space-md);
}

@media (min-width: var(--theme-breakpoint-sm)) {
  .modules__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: var(--theme-breakpoint-lg)) {
  .modules__grid {
    grid-template-columns: repeat(4, 1fr);
    gap: var(--theme-space-lg);
  }
}

.modules__card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.04), transparent 55%),
    var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.modules__card-bg-icon {
  position: absolute;
  right: 10;
  bottom: -2;
  width: 150%;
  height: 150%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  pointer-events: none;
}

.modules__card-bg-icon-svg {
  display: block;
  width: 100%;
  height: 100%;
  color: var(--theme-primary);
  opacity: 0.12;
}

.modules__card-bg-icon-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.modules__card--expanded {
  border-color: var(--theme-primary);
}

.modules__card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
}

.modules__card-trigger {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  width: 100%;
  padding: var(--theme-space-md);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--theme-text-primary);
  transition: background-color 0.15s ease;
}

.modules__card-trigger:hover {
  background: var(--theme-bg-secondary);
}

.modules__card-trigger[aria-expanded="true"] .modules__card-chevron-icon {
  transform: rotate(180deg);
}

.modules__card-header {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  width: 100%;
}

.modules__card-heading {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.modules__card-name-row {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  flex-wrap: wrap;
}

.modules__card-badge {
  font-size: 0.6rem;
  line-height: 1.2;
  color: var(--theme-text-muted);
  background: var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  padding: 2px 4px;
  border-radius: var(--theme-radius-sm);
  white-space: nowrap;
}

.modules__card-name {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  margin: 0;
}

.modules__card-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--theme-text-muted);
}

.modules__card-preview {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.modules__card-chevron {
  display: inline-flex;
  align-items: center;
  margin-top: var(--theme-space-xs);
  color: var(--theme-text-muted);
}

.modules__card-chevron-icon {
  font-size: 1.25rem;
  transition: transform 0.2s ease;
}

.modules__card-detail {
  position: relative;
  z-index: 1;
  padding: 0 var(--theme-space-md) var(--theme-space-md);
  border-top: 1px solid var(--theme-border);
}

.modules__card-detail[hidden] {
  display: none;
}

.modules__card-desc {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0 0 var(--theme-space-sm);
  line-height: 1.5;
}

.modules__card-key-info {
  margin: 0 0 var(--theme-space-sm);
  padding-left: var(--theme-space-lg);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.modules__card-key-info li {
  margin-bottom: var(--theme-space-xs);
}

.modules__card-pricing,
.modules__card-coming-soon {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  color: var(--theme-primary);
  margin: 0 0 var(--theme-space-sm);
}

.modules__card-pricing-label {
  font-weight: 400;
  color: var(--theme-text-muted);
  margin-right: var(--theme-space-xs);
}

.modules__card-learn-more {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
  font-size: var(--theme-font-sm);
  color: var(--theme-primary);
  text-decoration: none;
}

.modules__card-learn-more:hover {
  color: var(--theme-primary-hover);
}

.modules__card-learn-more-icon {
  font-size: 0.875rem;
}
</style>
