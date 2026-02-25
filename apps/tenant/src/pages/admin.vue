<template>
  <PageSection title="Admin">
    <div class="admin">
      <div v-if="tab === 'general'" class="admin__panel">
        <Card>
          <h3>General</h3>
          <TextInput
            :model-value="slug ?? ''"
            label="Slug"
            disabled
          />
          <TextInput
            v-model="form.name"
            label="Name"
          />
          <TextInput
            v-model="form.description"
            label="Description"
          />
        </Card>
      </div>

      <div v-else-if="tab === 'theming'" class="admin__panel">
        <AdminThemeSettings :branding="form.branding" />
      </div>

      <div v-else-if="tab === 'modules'" class="admin__panel">
        <Card>
          <h3>Modules</h3>
          <div
            v-for="id in moduleIds"
            :key="id"
            class="admin__module"
          >
            <span>{{ MODULE_NAV[id]?.label ?? id }}</span>
            <div v-if="id !== 'admin'" class="admin__module-controls">
              <span v-if="moduleDeactivationDate(id)" class="admin__module-date">
                Deactivate at {{ formatDeactivationDate(moduleDeactivationDate(id)) }}
              </span>
              <select
                :value="form.modulesById[id]"
                class="admin__state-select"
                @change="onModuleStateChange(id, ($event.target as HTMLSelectElement).value as ModuleState)"
              >
                <option
                  v-for="opt in MODULE_STATES"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <span v-else class="admin__module-always-on">Always on</span>
          </div>
        </Card>
      </div>

      <div v-else-if="tab === 'marketplace'" class="admin__panel">
        <AdminModuleDeployCard
          :module-state="marketplaceModuleState"
          staging-hint="Configure the marketplace below, then deploy to make it active for members."
          deactivating-hint="Module is deactivating. Members can only cancel or claim; no new trades."
          :deploying="deploying"
          :saving="saving"
          @deploy="deployModule('marketplace')"
          @reactivate="reactivateModule('marketplace')"
        />
        <AdminMarketplaceSettings
          :slug="slug ?? ''"
          :settings="marketplaceSettings"
          @saved="onMarketplaceSaved"
        />
      </div>

      <div v-else-if="tab === 'discord'" class="admin__panel">
        <AdminModuleDeployCard
          :module-state="discordModuleState"
          staging-hint="Configure Discord below, then deploy to make it active for members."
          deactivating-hint="Module is deactivating. Members can only unlink wallets."
          :deploying="deploying"
          :saving="saving"
          @deploy="deployModule('discord')"
          @reactivate="reactivateModule('discord')"
        />
        <AdminDiscordSettings :slug="slug ?? ''" />
      </div>

      <div class="admin__actions">
        <Button variant="primary" :disabled="saving" @click="save">
          Save
        </Button>
        <p v-if="saveError" class="admin__error">{{ saveError }}</p>
      </div>
    </div>

    <AdminMarketplaceOnboardingModal
      v-model="showMarketplaceOnboarding"
    />
  </PageSection>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth' })
import type { ModuleState } from '@decentraguild/core'
import { getModuleState } from '@decentraguild/core'
import { PageSection, Card, TextInput, Button } from '@decentraguild/ui/components'
import { useThemeStore, mergeTheme, DEFAULT_TENANT_THEME } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_NAV, MODULE_SUBNAV } from '~/config/modules'
import type { MarketplaceSettings } from '@decentraguild/core'
import AdminMarketplaceSettings from '~/components/AdminMarketplaceSettings.vue'
import AdminMarketplaceOnboardingModal from '~/components/AdminMarketplaceOnboardingModal.vue'
import AdminModuleDeployCard from '~/components/AdminModuleDeployCard.vue'
import AdminThemeSettings from '~/components/AdminThemeSettings.vue'
import AdminDiscordSettings from '~/components/AdminDiscordSettings.vue'
import { API_V1 } from '~/utils/apiBase'

const MODULE_STATES: { value: ModuleState; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'staging', label: 'Staging' },
  { value: 'active', label: 'Active' },
  { value: 'deactivating', label: 'Deactivating' },
]

const route = useRoute()
const tenantStore = useTenantStore()
const apiBase = useApiBase()
const tenant = computed(() => tenantStore.tenant)
const slug = computed(() => tenantStore.slug)

const moduleIds = computed(() => Object.keys(MODULE_NAV))

const VALID_TABS = new Set(MODULE_SUBNAV.admin?.map((t) => t.id) ?? ['general', 'modules', 'theming', 'marketplace', 'discord'])

const showMarketplaceOnboarding = ref(false)
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
const deploying = ref(false)

function moduleDeactivationDate(moduleId: string): string | null {
  const entry = tenant.value?.modules?.[moduleId] as { deactivatedate?: string | null } | undefined
  const d = entry?.deactivatedate
  return d && typeof d === 'string' ? d : null
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

function onModuleStateChange(id: string, value: ModuleState) {
  if (id === 'marketplace' && value === 'staging') {
    showMarketplaceOnboarding.value = true
  }
  form.modulesById[id] = value
}

async function deployModule(moduleId: string) {
  if (!slug.value) return
  deploying.value = true
  try {
    const prevMods = tenant.value?.modules ?? {}
    const modules = { ...prevMods }
    const prev = (modules[moduleId] ?? {}) as { state?: ModuleState; deactivatedate?: string | null; deactivatingUntil?: string | null; settingsjson?: Record<string, unknown> }
    const config = useRuntimeConfig()
    const testTiming = import.meta.dev || (config.public?.moduleLifecycleTestTiming as boolean) === true
    const deactivatedate = testTiming ? new Date(Date.now() + 2 * 60 * 1000).toISOString() : null
    modules[moduleId] = {
      state: 'active',
      deactivatedate: deactivatedate ?? prev.deactivatedate ?? null,
      deactivatingUntil: prev.deactivatingUntil ?? null,
      settingsjson: prev.settingsjson ?? {},
    }
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${slug.value}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ modules }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Deploy failed')
    }
    const data = await res.json()
    tenantStore.setTenant(data.tenant)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Deploy failed'
  } finally {
    deploying.value = false
  }
}

async function reactivateModule(moduleId: string) {
  if (!slug.value) return
  saving.value = true
  saveError.value = null
  try {
    const prevMods = tenant.value?.modules ?? {}
    const modules = { ...prevMods }
    const prev = (modules[moduleId] ?? {}) as { deactivatedate?: string | null; deactivatingUntil?: string | null; settingsjson?: Record<string, unknown> }
    modules[moduleId] = {
      state: 'active',
      deactivatedate: null,
      deactivatingUntil: null,
      settingsjson: prev.settingsjson ?? {},
    }
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${slug.value}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ modules }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Reactivate failed')
    }
    const data = await res.json()
    tenantStore.setTenant(data.tenant)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Reactivate failed'
  } finally {
    saving.value = false
  }
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
const tab = computed(() => {
  const q = route.query.tab
  return typeof q === 'string' && VALID_TABS.has(q) ? q : 'general'
})

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
const saving = ref(false)
const saveError = ref<string | null>(null)

function buildBrandingForm(tenant: { branding?: { logo?: string; theme?: unknown } } | null) {
  const theme = mergeTheme(DEFAULT_TENANT_THEME, (tenant?.branding?.theme ?? {}) as Parameters<typeof mergeTheme>[1])
  return {
    logo: tenant?.branding?.logo ?? '',
    theme,
  }
}

const form = reactive({
  name: '',
  description: '',
  branding: buildBrandingForm(null),
  modulesById: {} as Record<string, ModuleState>,
})

watch(
  tenant,
  (t) => {
    if (!t) {
      form.modulesById = Object.fromEntries(moduleIds.value.map((id) => [id, 'off']))
      form.branding = buildBrandingForm(null)
      return
    }
    form.name = t.name ?? ''
    form.description = t.description ?? ''
    form.branding = buildBrandingForm(t)
    const mods = t.modules ?? {}
    form.modulesById = Object.fromEntries(
      moduleIds.value.map((id) => [id, (mods[id]?.state ?? 'off') as ModuleState])
    )
  },
  { immediate: true }
)

async function save() {
  if (!slug.value) return
  saving.value = true
  saveError.value = null
  try {
    const prevMods = tenant.value?.modules ?? {}
    const modules: Record<string, { state: ModuleState; deactivatedate: string | null; deactivatingUntil: string | null; settingsjson: Record<string, unknown> }> = {}
    for (const id of moduleIds.value) {
      const prev = prevMods[id] as { state?: ModuleState; deactivatedate?: string | null; deactivatingUntil?: string | null; settingsjson?: Record<string, unknown> } | undefined
      const state = id === 'admin' ? 'active' : (form.modulesById[id] ?? 'off')
      modules[id] = {
        state: state as ModuleState,
        deactivatedate: prev?.deactivatedate ?? null,
        deactivatingUntil: prev?.deactivatingUntil ?? null,
        settingsjson: prev?.settingsjson ?? {},
      }
    }
    const base = apiBase.value
    const res = await fetch(`${base}${API_V1}/tenant/${slug.value}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        branding: {
          logo: form.branding.logo,
          theme: form.branding.theme,
        },
        modules,
      }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      const msg = data.error ?? (res.status === 503 ? 'API cannot persist (set DATABASE_URL or TENANT_CONFIG_PATH).' : 'Failed to save')
      throw new Error(msg)
    }
    const data = await res.json()
    tenantStore.setTenant(data.tenant)
    useThemeStore().loadTheme(
      data.tenant.branding?.theme ?? {},
      data.tenant.branding
    )
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
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

.admin__state-select {
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md, 4px);
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  font-size: var(--theme-font-sm);
}

.admin__module-controls {
  display: flex;
  align-items: center;
  gap: var(--theme-space-md);
  flex-wrap: wrap;
}

.admin__module-date {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.admin__module-always-on {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.admin__actions {
  margin-top: var(--theme-space-lg);
}

.admin__error {
  color: var(--theme-error);
  font-size: var(--theme-font-sm);
  margin-top: var(--theme-space-sm);
}
</style>
