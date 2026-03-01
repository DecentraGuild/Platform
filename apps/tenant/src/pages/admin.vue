<template>
  <PageSection :title="adminPageTitle">
    <div class="admin">
      <AdminGeneralTab
        v-if="tab === 'general'"
        :form="form"
        :tenant="tenant ?? null"
        :show-slug-unlock="showSlugUnlock"
        :desired-slug="desiredSlug"
        :slug-check-status="slugCheckStatus"
        :slug-checking="slugChecking"
        :slug-claiming="slugClaiming"
        @toggle-slug-unlock="toggleSlugUnlock"
        @update:desired-slug="(v: string) => { slugClaim.desiredSlug.value = v }"
        @slug-check-blur="slugClaim.onSlugCheckBlur()"
        @check-slug="slugClaim.checkSlugAvailability()"
        @claim-slug="slugClaim.claimSlug()"
      >
        <template #sidebar>
          <AdminPricingWidget
            v-if="showSlugPricingWidget"
            module-id="slug"
            :module-state="slugModuleState"
            :subscription="subscriptions.slug"
            :yearly-only="true"
            :saving="saving"
            :deploying="slugClaiming"
            :save-error="saveError"
            @deploy="(p: BillingPeriod) => slugClaim.claimSlugWithPeriod(p)"
            @extend="(p: BillingPeriod) => slugClaim.extendSlug(p)"
            @reactivate="(p: BillingPeriod) => slugClaim.extendSlug(p)"
          />
        </template>
      </AdminGeneralTab>

      <AdminThemingTab
        v-else-if="tab === 'theming'"
        :branding="form.branding"
      />

      <AdminModulesTab
        v-else-if="tab === 'modules'"
        :form="form"
        :tenant="tenant ?? null"
        :module-ids="moduleIds"
        :subscriptions="subscriptions"
        :extending-module-id="extendingModuleId"
        :extending="extending"
        :extend-period="extendPeriod"
        @module-toggle="onModuleToggle"
        @start-extend="startExtend"
        @confirm-extend="confirmExtend"
        @cancel-extend="cancelExtend"
        @update:extend-period="setExtendPeriod"
      />

      <AdminMarketplaceTab
        v-else-if="tab === 'marketplace'"
        :slug="slug ?? ''"
        :settings="marketplaceSettings"
        :module-state="marketplaceModuleState"
        :subscription="subscriptions.marketplace"
        :saving="saving"
        :deploying="deploying"
        :save-error="saveError"
        @saved="onMarketplaceSaved"
        @save="(p: BillingPeriod) => handleBillingPayment('marketplace', p)"
        @deploy="(p: BillingPeriod) => deployModule('marketplace', p)"
        @reactivate="(p: BillingPeriod) => reactivateModule('marketplace', p)"
      />

      <AdminDiscordTab
        v-else-if="tab === 'discord'"
        :slug="slug ?? ''"
        :module-state="discordModuleState"
        :subscription="subscriptions.discord"
        :saving="saving"
        :deploying="deploying"
        :save-error="saveError"
        @save="(p: BillingPeriod) => saveWithBilling('discord', p)"
        @deploy="(p: BillingPeriod) => deployModule('discord', p)"
        @reactivate="(p: BillingPeriod) => reactivateModule('discord', p)"
      />

      <AdminBillingTab
        v-else-if="tab === 'billing'"
        :slug="slug"
      />

      <div v-if="!hasWidgetTab && tab !== 'billing'" class="admin__actions">
        <Button variant="primary" :disabled="saving" @click="save">
          Save
        </Button>
        <p v-if="saveError" class="admin__error">{{ saveError }}</p>
      </div>
    </div>

    <AdminModuleActivationModal
      :model-value="showActivationModal"
      :module-id="activationModalModuleId"
      @update:model-value="showActivationModal = $event; if (!$event) activationModalModuleId = null"
    />

    <Modal
      :model-value="showDeactivateConfirm"
      title="Disable module?"
      @update:model-value="(v: boolean) => !v && cancelDeactivate()"
    >
      <div v-if="pendingDeactivateModuleId" class="admin__deactivate-modal">
        <p>
          The module will stay active until the end of your current billing period.
          After that, it will turn off automatically.
        </p>
        <p v-if="subscriptions[pendingDeactivateModuleId]?.periodEnd" class="admin__deactivate-date">
          End of period: {{ formatDeactivationDate(subscriptions[pendingDeactivateModuleId].periodEnd) }}
        </p>
        <div class="admin__deactivate-actions">
          <Button variant="secondary" @click="cancelDeactivate">
            Cancel
          </Button>
          <Button variant="primary" @click="confirmDeactivate">
            Disable at period end
          </Button>
        </div>
      </div>
    </Modal>
  </PageSection>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth' })
import type { ModuleState } from '@decentraguild/core'
import type { BillingPeriod } from '@decentraguild/billing'
import { getModuleState } from '@decentraguild/core'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { PageSection, Button, Modal } from '@decentraguild/ui/components'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_SUBNAV } from '~/config/modules'
import type { MarketplaceSettings } from '@decentraguild/core'
import AdminGeneralTab from '~/components/admin/AdminGeneralTab.vue'
import AdminThemingTab from '~/components/admin/AdminThemingTab.vue'
import AdminModulesTab from '~/components/admin/AdminModulesTab.vue'
import AdminMarketplaceTab from '~/components/admin/AdminMarketplaceTab.vue'
import AdminDiscordTab from '~/components/admin/AdminDiscordTab.vue'
import AdminBillingTab from '~/components/admin/AdminBillingTab.vue'
import AdminModuleActivationModal from '~/components/AdminModuleActivationModal.vue'
import AdminPricingWidget from '~/components/AdminPricingWidget.vue'
import { useAdminSubscriptions } from '~/composables/useAdminSubscriptions'
import { useAdminForm } from '~/composables/useAdminForm'
import { useAdminBilling } from '~/composables/useAdminBilling'
import { useSlugClaim } from '~/composables/useSlugClaim'

const route = useRoute()
const tenantStore = useTenantStore()

const { subscriptions, fetchSubscription, slug } = useAdminSubscriptions()
const { form, tenant, moduleIds, saving, saveError, save } = useAdminForm(subscriptions)

const deploying = ref(false)
const extending = ref(false)
const extendingModuleId = ref<string | null>(null)
const extendPeriod = ref<BillingPeriod>('monthly')

const { handleBillingPayment, deployModule, reactivateModule, extendModule } = useAdminBilling({
  saveError,
  saving,
  deploying,
  extending,
  fetchSubscription,
})

const slugClaim = useSlugClaim({
  slug,
  saveError,
  saving,
  handleBillingPayment,
  fetchSubscription,
})

function toggleSlugUnlock() {
  slugClaim.showSlugUnlock.value = !slugClaim.showSlugUnlock.value
}

const showSlugUnlock = computed(() => slugClaim.showSlugUnlock.value)
const desiredSlug = computed(() => slugClaim.desiredSlug.value)
const slugCheckStatus = computed(() => slugClaim.slugCheckStatus.value)
const slugChecking = computed(() => slugClaim.slugChecking.value)
const slugClaiming = computed(() => slugClaim.slugClaiming.value)

const VALID_TABS = new Set(MODULE_SUBNAV.admin?.map((t) => t.id) ?? ['general', 'modules', 'theming', 'marketplace', 'discord', 'billing'])

const adminPageTitle = computed(() => {
  const tabEntry = MODULE_SUBNAV.admin?.find((t) => t.id === tab.value)
  return tabEntry ? `Admin - ${tabEntry.label}` : 'Admin'
})

const showActivationModal = ref(false)
const activationModalModuleId = ref<string | null>(null)
const marketplaceSettings = computed(() => {
  const s = tenantStore.marketplaceSettings
  if (!s) return null
  return {
    collectionMints: s.collectionMints,
    splAssetMints: s.splAssetMints ?? [],
    currencyMints: s.currencyMints,
    whitelist: s.whitelist,
    shopFee: s.shopFee,
  }
})

const marketplaceModuleState = computed(() => getModuleState(tenant.value?.modules?.marketplace))
const discordModuleState = computed(() => getModuleState(tenant.value?.modules?.discord))

const slugModuleState = computed((): 'off' | 'staging' | 'active' | 'deactivating' => {
  if (tenant.value?.slug) return 'active'
  return 'staging'
})

const showSlugPricingWidget = computed(() => Boolean(tenant.value))

const WIDGET_TABS = new Set(['marketplace', 'discord'])
const tab = computed(() => {
  const q = route.query.tab
  return typeof q === 'string' && VALID_TABS.has(q) ? q : 'general'
})
const hasWidgetTab = computed(() => WIDGET_TABS.has(tab.value))

async function saveWithBilling(moduleId: string, billingPeriod: BillingPeriod) {
  await save()
  await handleBillingPayment(moduleId, billingPeriod)
}

function formatDeactivationDate(iso: string): string {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

const showDeactivateConfirm = ref(false)
const pendingDeactivateModuleId = ref<string | null>(null)

function onModuleToggle(id: string, on: boolean) {
  if (on) {
    form.modulesById[id] = 'staging'
    if (getModuleCatalogEntry(id)?.pricing) {
      activationModalModuleId.value = id
      showActivationModal.value = true
    }
  } else {
    const current = form.modulesById[id] ?? 'off'
    if (current === 'staging') {
      form.modulesById[id] = 'off'
    } else if (current === 'active') {
      pendingDeactivateModuleId.value = id
      showDeactivateConfirm.value = true
    }
  }
}

function confirmDeactivate() {
  const id = pendingDeactivateModuleId.value
  if (id) {
    form.modulesById[id] = 'deactivating'
  }
  pendingDeactivateModuleId.value = null
  showDeactivateConfirm.value = false
}

function cancelDeactivate() {
  pendingDeactivateModuleId.value = null
  showDeactivateConfirm.value = false
}

function cancelExtend() {
  extendingModuleId.value = null
  extendPeriod.value = 'monthly'
}

function setExtendPeriod(v: BillingPeriod) {
  extendPeriod.value = v
}

function onMarketplaceSaved(settings: Record<string, unknown>) {
  const s = settings as {
    collectionMints?: unknown[]
    splAssetMints?: unknown[]
    currencyMints?: unknown[]
    whitelist?: { programId?: string; account?: string }
    shopFee?: unknown
  }
  tenantStore.setMarketplaceSettings(
    s
      ? {
          collectionMints: s.collectionMints ?? [],
          splAssetMints: (s.splAssetMints as Array<{ mint: string; name?: string; symbol?: string }>) ?? [],
          currencyMints: (s.currencyMints as Array<{ mint: string; name: string; symbol: string }>) ?? [],
          whitelist: s.whitelist,
          shopFee: (s.shopFee as MarketplaceSettings['shopFee']) ?? {
            wallet: '',
            makerFlatFee: 0,
            takerFlatFee: 0,
            makerPercentFee: 0,
            takerPercentFee: 0,
          },
        }
      : null
  )
}
onMounted(() => {
  const q = route.query.tab
  if (typeof q !== 'string' || !VALID_TABS.has(q)) {
    navigateTo({
      path: route.path,
      query: { ...route.query, tab: 'general' },
      replace: true,
    })
  }
})

watch(tab, (t) => {
  if (t === 'general') fetchSubscription('slug')
  if (t === 'marketplace') fetchSubscription('marketplace')
  if (t === 'discord') fetchSubscription('discord')
  if (t === 'modules') {
    for (const id of moduleIds.value) {
      if (id !== 'admin' && getModuleCatalogEntry(id)?.pricing) fetchSubscription(id)
    }
  }
}, { immediate: true })

function startExtend(moduleId: string) {
  extendingModuleId.value = moduleId
  extendPeriod.value = 'monthly'
}

async function confirmExtend(moduleId: string) {
  await extendModule(moduleId, extendPeriod.value)
  extendingModuleId.value = null
}
</script>

<style>
/* Unscoped: admin__* classes used in tab components (General, Modules, Marketplace, Discord, Billing) */
.admin__split {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--theme-space-lg);
}
@media (min-width: 1024px) {
  .admin__split {
    grid-template-columns: 1fr 300px;
  }
  .admin__split > .pricing-widget {
    position: sticky;
    top: var(--theme-space-lg);
    align-self: start;
  }
}
.admin__panel {
  margin-bottom: var(--theme-space-lg);
}
.admin__panel h3 {
  font-size: var(--theme-font-lg);
  margin-bottom: var(--theme-space-md);
}
.admin__panel .text-input,
.admin__panel .toggle {
  margin-bottom: var(--theme-space-md);
}
.admin__tenant-id {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-md);
  font-size: var(--theme-font-sm);
}
.admin__tenant-id-label {
  font-weight: 500;
  color: var(--theme-text-secondary);
}
.admin__tenant-id code,
.admin__tenant-id-hint code {
  background: var(--theme-bg-secondary);
  padding: 2px var(--theme-space-xs);
  border-radius: var(--theme-radius-sm);
  font-size: var(--theme-font-xs);
}
.admin__tenant-id-hint {
  color: var(--theme-text-muted);
}
.admin__slug-row {
  display: flex;
  align-items: flex-end;
  gap: var(--theme-space-md);
}
.admin__slug-row .text-input {
  flex: 1;
  margin-bottom: 0;
}
.admin__slug-enable-btn {
  flex-shrink: 0;
}
.admin__slug-unlock {
  margin-top: var(--theme-space-md);
  padding: var(--theme-space-md);
  background: var(--theme-surface-secondary);
  border-radius: var(--theme-radius-md);
}
.admin__slug-unlock .text-input {
  margin-bottom: var(--theme-space-sm);
}
.admin__slug-actions {
  display: flex;
  gap: var(--theme-space-sm);
  margin-top: var(--theme-space-sm);
}
.admin__slug-available {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  color: var(--theme-success);
}
.admin__slug-taken {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  color: var(--theme-error);
}
.admin__slug-check-icon {
  width: 1.25rem;
  height: 1.25rem;
}
.admin__module {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-sm) 0;
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}
.admin__module:last-child {
  border-bottom: none;
}
.admin__module-name {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
}
.admin__module-info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: none;
  border: none;
  color: var(--theme-text-muted);
  cursor: pointer;
  border-radius: var(--theme-radius-sm);
}
.admin__module-info-btn:hover {
  color: var(--theme-primary);
}
.admin__module-info-icon {
  font-size: 1rem;
}
.admin__module-info-modal {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}
.admin__module-info-desc {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  line-height: 1.5;
}
.admin__module-info-link {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
  font-size: var(--theme-font-sm);
  color: var(--theme-primary);
}
.admin__module-info-link:hover {
  text-decoration: underline;
}
.admin__module-staging-label {
  font-size: var(--theme-font-sm);
  font-weight: 500;
  color: var(--theme-warning);
}
.admin__module-controls {
  display: flex;
  align-items: center;
  gap: var(--theme-space-md);
  flex-wrap: wrap;
}
.admin__module-date,
.admin__module-always-on {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}
.admin__extend-inline {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
}
.admin__extend-inline .pricing-widget__period-toggle {
  display: flex;
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  overflow: hidden;
}
.admin__extend-inline .pricing-widget__period-btn {
  padding: 2px var(--theme-space-xs);
  font-size: var(--theme-font-xs);
  font-weight: 500;
  background: transparent;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
}
.admin__extend-inline .pricing-widget__period-btn--active {
  background: var(--theme-primary);
  color: var(--theme-text-on-primary, #fff);
}
.admin__extend-cancel {
  background: none;
  border: none;
  color: var(--theme-text-muted);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  font-size: var(--theme-font-md);
}
.admin__extend-cancel:hover {
  color: var(--theme-text-primary);
}
.admin__spinner {
  animation: admin-spin 1s linear infinite;
}
@keyframes admin-spin {
  to { transform: rotate(360deg); }
}
.admin__billing-loading {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  color: var(--theme-text-muted);
  font-size: var(--theme-font-sm);
}
.admin__billing-empty {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}
.admin__billing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--theme-font-sm);
}
.admin__billing-table th {
  text-align: left;
  font-weight: 600;
  color: var(--theme-text-secondary);
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
  white-space: nowrap;
}
.admin__billing-table td {
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
  color: var(--theme-text-primary);
  white-space: nowrap;
}
.admin__billing-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.admin__billing-tx-link {
  color: var(--theme-primary);
  display: inline-flex;
  align-items: center;
}
.admin__billing-invoice-btn {
  background: none;
  border: none;
  color: var(--theme-primary);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  font-size: var(--theme-font-md);
}
.admin__billing-invoice-btn:hover {
  color: var(--theme-text-primary);
}
</style>

<style scoped>
.admin__state-select {
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md, 4px);
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-size: var(--theme-font-sm);
}

.admin__actions {
  margin-top: var(--theme-space-lg);
}

.admin__error {
  color: var(--theme-error);
  font-size: var(--theme-font-sm);
  margin-top: var(--theme-space-sm);
}

.admin__deactivate-modal {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.admin__deactivate-modal p {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  line-height: 1.5;
}

.admin__deactivate-date {
  font-weight: 500;
  color: var(--theme-text-primary);
}

.admin__deactivate-actions {
  display: flex;
  gap: var(--theme-space-sm);
  justify-content: flex-end;
  margin-top: var(--theme-space-sm);
}

/* Staging: toggle uses warning color */
.admin__module--staging :deep(.toggle__input:checked + .toggle__track) {
  background-color: var(--theme-warning);
  border-color: var(--theme-warning);
}
</style>
