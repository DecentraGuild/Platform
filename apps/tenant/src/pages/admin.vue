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
            <Toggle
              :model-value="form.modulesById[id]"
              :label="form.modulesById[id] ? 'On' : 'Off'"
              @update:model-value="onModuleToggle(id, $event)"
            />
          </div>
        </Card>
      </div>

      <div v-else-if="tab === 'marketplace'" class="admin__panel">
        <AdminMarketplaceSettings
          :slug="slug ?? ''"
          :settings="marketplaceSettings"
          @saved="onMarketplaceSaved"
        />
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
import { PageSection, Card, TextInput, Toggle, Button } from '@decentraguild/ui/components'
import { useThemeStore, mergeTheme, DEFAULT_TENANT_THEME } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_NAV, MODULE_SUBNAV } from '~/config/modules'
import type { MarketplaceSettings } from '~/stores/tenant'
import AdminMarketplaceSettings from '~/components/AdminMarketplaceSettings.vue'
import AdminMarketplaceOnboardingModal from '~/components/AdminMarketplaceOnboardingModal.vue'
import AdminThemeSettings from '~/components/AdminThemeSettings.vue'

const route = useRoute()
const tenantStore = useTenantStore()
const apiBase = useApiBase()
const tenant = computed(() => tenantStore.tenant)
const slug = computed(() => tenantStore.slug)

const moduleIds = computed(() => Object.keys(MODULE_NAV))

const VALID_TABS = new Set(MODULE_SUBNAV.admin?.map((t) => t.id) ?? ['general', 'modules', 'theming', 'marketplace'])

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

function onModuleToggle(id: string, value: boolean) {
  if (id === 'marketplace' && value) {
    showMarketplaceOnboarding.value = true
  }
  form.modulesById[id] = value
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
  modulesById: {} as Record<string, boolean>,
})

watch(
  tenant,
  (t) => {
    if (!t) {
      form.modulesById = Object.fromEntries(moduleIds.value.map((id) => [id, false]))
      form.branding = buildBrandingForm(null)
      return
    }
    form.name = t.name ?? ''
    form.description = t.description ?? ''
    form.branding = buildBrandingForm(t)
    const mods = t.modules ?? {}
    form.modulesById = Object.fromEntries(
      moduleIds.value.map((id) => [id, mods[id]?.active ?? false])
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
    const modules: Record<string, { active: boolean; deactivatedate: null; settingsjson: Record<string, unknown> }> = {}
    for (const id of moduleIds.value) {
      const prev = prevMods[id]
      modules[id] = {
        active: form.modulesById[id] ?? false,
        deactivatedate: prev?.deactivatedate ?? null,
        settingsjson: prev?.settingsjson ?? {},
      }
    }
    const base = apiBase.value
    const res = await fetch(`${base}/api/v1/tenant/${slug.value}/settings`, {
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

.admin__actions {
  margin-top: var(--theme-space-lg);
}

.admin__error {
  color: var(--theme-error);
  font-size: var(--theme-font-sm);
  margin-top: var(--theme-space-sm);
}
</style>
