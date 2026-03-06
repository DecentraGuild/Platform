<template>
  <div class="admin__split">
    <div class="admin__panel">
      <AdminMarketplaceSettings
        ref="settingsRef"
        :slug="slug"
        :settings="settings"
        @saved="onSaved"
        @saving="marketplaceSaving = $event"
      />
    </div>
    <AdminPricingWidget
      ref="pricingRef"
      module-id="marketplace"
      :module-state="moduleState"
      :conditions="liveConditions"
      :subscription="subscription"
      :saving="marketplaceSaving"
      :deploying="deploying"
      :save-error="saveError"
      @save="onSave"
      @deploy="onDeploy"
      @reactivate="(p: BillingPeriod) => emit('reactivate', p)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ModuleState } from '@decentraguild/core'
import type { BillingPeriod } from '@decentraguild/billing'
import { BASE_CURRENCY_MINT_ADDRESSES } from '@decentraguild/core'
import AdminMarketplaceSettings from '~/components/AdminMarketplaceSettings.vue'
import AdminPricingWidget from '~/components/AdminPricingWidget.vue'

defineProps<{
  slug: string
  settings: MarketplaceSettingsComputed | null
  moduleState: ModuleState
  subscription: { periodEnd?: string } | null
  saving: boolean
  deploying: boolean
  saveError: string | null
}>()

const emit = defineEmits<{
  saved: [payload: Record<string, unknown>]
  save: [period: BillingPeriod]
  deploy: [period: BillingPeriod]
  reactivate: [period: BillingPeriod]
}>()

type MarketplaceSettingsComputed = {
  collectionMints: Array<{ mint: string; [k: string]: unknown }>
  splAssetMints: Array<{ mint: string }>
  currencyMints: Array<{ mint: string }>
  whitelist: unknown
  shopFee: { makerFlatFee: number; takerFlatFee: number; makerPercentFee: number; takerPercentFee: number }
}

const settingsRef = ref<InstanceType<typeof AdminMarketplaceSettings> | null>(null)
const marketplaceSaving = ref(false)

const liveConditions = computed(() => {
  const f = settingsRef.value?.form
  if (!f) return null
  const mintsCount = f.collectionMints.length + (f.splAssetMints?.length ?? 0)
  const baseCurrenciesCount = f.currencyMints.filter((c: { mint: string }) => BASE_CURRENCY_MINT_ADDRESSES.has(c.mint)).length
  const customCurrenciesCount = f.currencyMints.length - baseCurrenciesCount
  const fee = f.shopFee
  const monetizeStorefront = fee.makerFlatFee > 0 || fee.takerFlatFee > 0 || fee.makerPercentFee > 0 || fee.takerPercentFee > 0
  return { mintsCount, baseCurrenciesCount, customCurrenciesCount, monetizeStorefront }
})

const pricingRef = ref<InstanceType<typeof AdminPricingWidget> | null>(null)

async function onSave(period: BillingPeriod) {
  const ok = await settingsRef.value?.save()
  if (!ok) return
  emit('save', period)
}

async function onDeploy(period: BillingPeriod) {
  const ok = await settingsRef.value?.save()
  if (!ok) return
  emit('deploy', period)
}

function onSaved(payload: Record<string, unknown>) {
  pricingRef.value?.refresh?.()
  emit('saved', payload)
}

defineExpose({ settingsRef, pricingRef, save: () => settingsRef.value?.save() ?? Promise.resolve(false) })
</script>
