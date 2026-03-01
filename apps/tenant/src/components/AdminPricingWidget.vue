<template>
  <aside class="pricing-widget">
    <div v-if="loading" class="pricing-widget__loading">
      <Icon icon="mdi:loading" class="pricing-widget__spinner" />
      <span>Loading pricing...</span>
    </div>

    <template v-else-if="price?.billable && selectedTier">
      <div class="pricing-widget__tier">
        <span class="pricing-widget__tier-name">{{ selectedTier.name }}</span>
        <span class="pricing-widget__tier-price">
          {{ formatUsdc(selectedPeriod === 'yearly' ? price.recurringYearly / 12 : price.recurringMonthly) }} USDC/mo
          <span v-if="selectedPeriod === 'yearly' && price.appliedYearlyDiscount" class="pricing-widget__tier-note">
            ({{ price.appliedYearlyDiscount }}% off yearly)
          </span>
        </span>
      </div>

      <div class="pricing-widget__usage">
        <div
          v-for="row in usageRows"
          :key="row.key"
          class="pricing-widget__usage-row"
        >
          <div class="pricing-widget__usage-header">
            <span class="pricing-widget__usage-label">{{ row.label }}</span>
            <span v-if="row.type === 'numeric'" class="pricing-widget__usage-count">
              {{ row.current }} / {{ row.included }}
            </span>
            <span v-else class="pricing-widget__usage-bool">
              <Icon v-if="row.active" icon="mdi:check" class="pricing-widget__icon-check" />
              <span v-else class="pricing-widget__icon-dash">--</span>
            </span>
          </div>
          <div v-if="row.type === 'numeric'" class="pricing-widget__bar-track">
            <div
              class="pricing-widget__bar-fill"
              :class="{ 'pricing-widget__bar-fill--over': row.ratio > 1 }"
              :style="{ width: `${Math.min(row.ratio * 100, 100)}%` }"
            />
          </div>
        </div>
      </div>

      <div v-if="addonComponents.length" class="pricing-widget__addons">
        <p class="pricing-widget__section-label">Add-ons</p>
        <div
          v-for="addon in addonComponents"
          :key="addon.name"
          class="pricing-widget__addon-row"
        >
          <span>{{ addon.name }} &times;{{ addon.quantity }}</span>
          <span>{{ formatUsdc(addon.amount) }} USDC/mo</span>
        </div>
      </div>

      <div class="pricing-widget__totals">
        <template v-if="selectedPeriod === 'yearly'">
          <div class="pricing-widget__total-row">
            <span>Effective monthly</span>
            <span class="pricing-widget__total-value">{{ formatUsdc(price.recurringYearly / 12) }} USDC/mo</span>
          </div>
          <div class="pricing-widget__total-row">
            <span>Yearly total</span>
            <span class="pricing-widget__total-value">{{ formatUsdc(price.recurringYearly) }} USDC/yr</span>
          </div>
        </template>
        <template v-else>
          <div class="pricing-widget__total-row">
            <span>Monthly</span>
            <span class="pricing-widget__total-value">{{ formatUsdc(price.recurringMonthly) }} USDC</span>
          </div>
        </template>
      </div>

      <div v-if="hasActiveSubscription" class="pricing-widget__subscription">
        <p class="pricing-widget__section-label">Current subscription</p>
        <div class="pricing-widget__sub-row">
          <span>Period</span>
          <span>{{ subscription!.billingPeriod === 'yearly' ? 'Yearly' : 'Monthly' }}</span>
        </div>
        <div class="pricing-widget__sub-row">
          <span>Renews / expires</span>
          <span>{{ formatDate(subscription!.periodEnd) }}</span>
        </div>
        <div class="pricing-widget__sub-row">
          <span>Recurring</span>
          <span>{{ formatUsdc(subscription!.recurringAmountUsdc) }} USDC</span>
        </div>
      </div>
    </template>

    <template v-else-if="price?.billable && moduleId === 'slug'">
      <div class="pricing-widget__tier">
        <span class="pricing-widget__tier-name">Custom slug</span>
        <span class="pricing-widget__tier-price">{{ formatUsdc(price.recurringYearly) }} USDC/yr</span>
      </div>
      <div v-if="hasActiveSubscription" class="pricing-widget__subscription">
        <p class="pricing-widget__section-label">Current subscription</p>
        <div class="pricing-widget__sub-row">
          <span>Period</span>
          <span>Yearly</span>
        </div>
        <div class="pricing-widget__sub-row">
          <span>Renews / expires</span>
          <span>{{ formatDate(subscription!.periodEnd) }}</span>
        </div>
        <div class="pricing-widget__sub-row">
          <span>Recurring</span>
          <span>{{ formatUsdc(subscription!.recurringAmountUsdc) }} USDC/yr</span>
        </div>
      </div>
    </template>

    <div v-else-if="price && !price.billable" class="pricing-widget__free">
      <span>No billing for this module</span>
    </div>

    <div v-if="error" class="pricing-widget__error">{{ error }}</div>

    <div class="pricing-widget__actions">
      <div v-if="price?.billable && !periodLocked && !yearlyOnly" class="pricing-widget__period-toggle">
        <button
          class="pricing-widget__period-btn"
          :class="{ 'pricing-widget__period-btn--active': selectedPeriod === 'monthly' }"
          @click="selectedPeriod = 'monthly'"
        >
          Monthly
        </button>
        <button
          class="pricing-widget__period-btn"
          :class="{ 'pricing-widget__period-btn--active': selectedPeriod === 'yearly' }"
          @click="selectedPeriod = 'yearly'"
        >
          Yearly
          <span v-if="yearlyDiscountLabel" class="pricing-widget__period-save">
            ({{ yearlyDiscountLabel }}% off)
          </span>
        </button>
      </div>

      <p v-if="moduleState === 'staging'" class="pricing-widget__hint">
        {{ moduleId === 'slug' ? 'Enter your desired slug in the form, then click Claim slug.' : 'Configure the module, then deploy to make it active for members.' }}
      </p>
      <p v-else-if="moduleState === 'deactivating'" class="pricing-widget__hint">
        Module is deactivating.
      </p>

      <Button
        v-if="moduleState === 'staging'"
        variant="primary"
        :disabled="deploying"
        @click="$emit('deploy', selectedPeriod)"
      >
        <Icon v-if="deploying" icon="mdi:loading" class="pricing-widget__spinner" />
        {{ deployLabel }}
      </Button>

      <Button
        v-else-if="moduleState === 'deactivating'"
        variant="secondary"
        :disabled="saving"
        @click="$emit('reactivate', selectedPeriod)"
      >
        Reactivate
      </Button>

      <Button
        v-else-if="moduleState === 'active' && moduleId === 'slug'"
        variant="primary"
        :disabled="saving"
        @click="$emit('extend', selectedPeriod)"
      >
        {{ saving ? 'Extending...' : 'Extend' }}
      </Button>
      <Button
        v-else-if="moduleState === 'active'"
        variant="primary"
        :disabled="saving"
        @click="$emit('save', selectedPeriod)"
      >
        {{ saving ? 'Saving...' : 'Save' }}
      </Button>

      <p v-if="saveError" class="pricing-widget__save-error">{{ saveError }}</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ModuleState } from '@decentraguild/core'
import type { BillingPeriod, PriceResult, ConditionSet, TieredAddonsPricing, TierDefinition } from '@decentraguild/billing'
import { computePrice } from '@decentraguild/billing'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import { usePricePreview } from '~/composables/usePricePreview'
import { useTenantStore } from '~/stores/tenant'

function formatUsdc(value: number): string {
  return parseFloat(value.toFixed(6)).toString()
}

function formatDate(iso: string | Date): string {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return String(iso)
  }
}

const CONDITION_LABELS: Record<string, string> = {
  mintsCount: 'Mints',
  baseCurrenciesCount: 'Base currencies',
  customCurrenciesCount: 'Custom currencies',
  monetizeStorefront: 'Monetize storefront',
}

export interface SubscriptionInfo {
  billingPeriod: BillingPeriod
  periodEnd: string
  recurringAmountUsdc: number
}

const props = withDefaults(
  defineProps<{
    moduleId: string
    moduleState: ModuleState
    saving: boolean
    deploying: boolean
    saveError: string | null
    /** Live conditions from the form. When provided, pricing is computed client-side. */
    conditions?: ConditionSet | null
    /** Current active subscription. When provided and module is active, locks the period toggle. */
    subscription?: SubscriptionInfo | null
    /** When true, hide monthly/yearly toggle and use yearly only (e.g. slug). */
    yearlyOnly?: boolean
  }>(),
  { yearlyOnly: false },
)

defineEmits<{
  save: [billingPeriod: BillingPeriod]
  deploy: [billingPeriod: BillingPeriod]
  reactivate: [billingPeriod: BillingPeriod]
  extend: [billingPeriod: BillingPeriod]
}>()

const selectedPeriod = ref<BillingPeriod>('monthly')

watch(
  () => props.yearlyOnly,
  (only) => {
    if (only) selectedPeriod.value = 'yearly'
  },
  { immediate: true },
)

const hasActiveSubscription = computed(() =>
  props.subscription != null && props.moduleState === 'active',
)

const periodLocked = computed(() => hasActiveSubscription.value)

watch(
  () => props.subscription,
  (sub) => {
    if (sub?.billingPeriod) {
      selectedPeriod.value = sub.billingPeriod
    }
  },
  { immediate: true },
)

const tenantStore = useTenantStore()
const slug = computed(() => tenantStore.slug)
const moduleIdRef = computed(() => props.moduleId)

const hasLiveConditions = computed(() => props.conditions != null && Object.keys(props.conditions).length > 0)

const { conditions: apiConditions, price: apiPrice, loading, error, refresh } = usePricePreview(slug, moduleIdRef, selectedPeriod)

defineExpose({ refresh, selectedPeriod })

const catalogEntry = computed(() => getModuleCatalogEntry(props.moduleId))

const pricingModel = computed(() => {
  const p = catalogEntry.value?.pricing
  if (!p || p.modelType !== 'tiered_addons') return null
  return p as TieredAddonsPricing
})

const conditions = computed((): ConditionSet | null => {
  if (hasLiveConditions.value) return props.conditions!
  return apiConditions.value
})

const price = computed((): PriceResult | null => {
  if (hasLiveConditions.value && catalogEntry.value?.pricing) {
    return computePrice(props.moduleId, props.conditions!, catalogEntry.value.pricing, {
      billingPeriod: selectedPeriod.value,
    })
  }
  return apiPrice.value
})

const selectedTier = computed((): TierDefinition | null => {
  if (!pricingModel.value || !price.value?.selectedTierId) return null
  return pricingModel.value.tiers.find((t) => t.id === price.value!.selectedTierId) ?? null
})

const yearlyDiscountLabel = computed(() => {
  if (!price.value?.appliedYearlyDiscount) {
    const p = catalogEntry.value?.pricing
    if (p && 'yearlyDiscountPercent' in p && p.yearlyDiscountPercent > 0) {
      return p.yearlyDiscountPercent
    }
    return null
  }
  return price.value.appliedYearlyDiscount
})

const chargeAmount = computed(() => {
  if (!price.value?.billable) return 0
  return selectedPeriod.value === 'yearly'
    ? price.value.recurringYearly
    : price.value.recurringMonthly
})

const deployLabel = computed(() => {
  if (props.deploying) return props.moduleId === 'slug' ? 'Claiming...' : 'Deploying...'
  if (props.moduleId === 'slug') {
    return chargeAmount.value > 0 ? `Claim for ${formatUsdc(chargeAmount.value)} USDC/yr` : 'Claim slug'
  }
  if (chargeAmount.value > 0) {
    return `Deploy for ${formatUsdc(chargeAmount.value)} USDC`
  }
  return 'Deploy'
})

interface NumericUsageRow {
  key: string
  label: string
  type: 'numeric'
  current: number
  included: number
  ratio: number
}

interface BooleanUsageRow {
  key: string
  label: string
  type: 'boolean'
  active: boolean
  included: boolean
}

type UsageRow = NumericUsageRow | BooleanUsageRow

const usageRows = computed((): UsageRow[] => {
  if (!pricingModel.value || !conditions.value || !selectedTier.value) return []

  return pricingModel.value.conditionKeys.map((key) => {
    const condVal = conditions.value![key]
    const inclVal = selectedTier.value!.included[key]
    const label = CONDITION_LABELS[key] ?? key

    if (typeof condVal === 'boolean' || typeof inclVal === 'boolean') {
      return {
        key,
        label,
        type: 'boolean' as const,
        active: condVal === true,
        included: inclVal === true,
      }
    }

    const current = typeof condVal === 'number' ? condVal : 0
    const included = typeof inclVal === 'number' ? inclVal : 0
    const ratio = included > 0 ? current / included : (current > 0 ? 1 : 0)

    return { key, label, type: 'numeric' as const, current, included, ratio }
  })
})

const addonComponents = computed(() => {
  if (!price.value) return []
  return price.value.components.filter((c) => c.type === 'recurring' && c.quantity > 0 && price.value?.selectedTierId && c.name !== selectedTier.value?.name)
})
</script>

<style scoped>
.pricing-widget {
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  padding: var(--theme-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.pricing-widget__loading {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  color: var(--theme-text-muted);
  font-size: var(--theme-font-sm);
}

.pricing-widget__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pricing-widget__tier {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.pricing-widget__tier-name {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
}

.pricing-widget__tier-price {
  font-size: var(--theme-font-md);
  color: var(--theme-primary);
  font-weight: 600;
}

.pricing-widget__tier-note {
  font-size: var(--theme-font-xs);
  font-weight: 400;
  color: var(--theme-text-secondary);
}

.pricing-widget__usage {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-sm);
}

.pricing-widget__usage-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pricing-widget__usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pricing-widget__usage-label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.pricing-widget__usage-count {
  font-size: var(--theme-font-sm);
  font-weight: 500;
  color: var(--theme-text-primary);
  font-variant-numeric: tabular-nums;
}

.pricing-widget__usage-bool {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-primary);
}

.pricing-widget__icon-check {
  color: var(--theme-success);
}

.pricing-widget__icon-dash {
  color: var(--theme-text-muted);
}

.pricing-widget__bar-track {
  height: 4px;
  background: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-full);
  overflow: hidden;
}

.pricing-widget__bar-fill {
  height: 100%;
  background: var(--theme-primary);
  border-radius: var(--theme-radius-full);
  transition: width 0.3s ease;
}

.pricing-widget__bar-fill--over {
  background: var(--theme-warning);
}

.pricing-widget__section-label {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}

.pricing-widget__addons {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
  padding-top: var(--theme-space-sm);
  border-top: var(--theme-border-thin) solid var(--theme-border);
}

.pricing-widget__addon-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.pricing-widget__totals {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
  padding-top: var(--theme-space-sm);
  border-top: var(--theme-border-thin) solid var(--theme-border);
}

.pricing-widget__total-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.pricing-widget__total-value {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.pricing-widget__subscription {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
  padding-top: var(--theme-space-sm);
  border-top: var(--theme-border-thin) solid var(--theme-border);
}

.pricing-widget__sub-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.pricing-widget__free {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.pricing-widget__error {
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
}

.pricing-widget__actions {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-sm);
  padding-top: var(--theme-space-sm);
  border-top: var(--theme-border-thin) solid var(--theme-border);
}

.pricing-widget__period-toggle {
  display: flex;
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  overflow: hidden;
}

.pricing-widget__period-btn {
  flex: 1;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: var(--theme-font-sm);
  font-weight: 500;
  background: transparent;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--theme-space-xs);
}

.pricing-widget__period-btn:hover {
  background: var(--theme-bg-secondary);
}

.pricing-widget__period-btn--active {
  background: var(--theme-primary);
  color: var(--theme-text-on-primary, #fff);
}

.pricing-widget__period-btn--active:hover {
  background: var(--theme-primary);
}

.pricing-widget__period-save {
  font-size: var(--theme-font-xs);
  font-weight: 400;
  opacity: 0.85;
}

.pricing-widget__hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0;
}

.pricing-widget__save-error {
  color: var(--theme-error);
  font-size: var(--theme-font-sm);
  margin: 0;
}
</style>
