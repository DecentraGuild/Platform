/**
 * Admin form state and save logic for General, Theming, and Modules tabs.
 * Form syncs from tenant; save() PATCHes settings with name, description, branding, modules.
 */

import type { ModuleState } from '@decentraguild/core'
import { useThemeStore, mergeTheme, DEFAULT_TENANT_THEME } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { API_V1 } from '~/utils/apiBase'
import { MODULE_NAV } from '~/config/modules'
import type { TenantConfig } from '@decentraguild/core'

export interface AdminForm {
  name: string
  description: string
  branding: {
    logo: string
    discordServerInviteLink: string
    theme: ReturnType<typeof mergeTheme>
  }
  modulesById: Record<string, ModuleState>
}

function buildBrandingForm(
  tenant: { branding?: { logo?: string; discordServerInviteLink?: string; theme?: unknown } } | null
): AdminForm['branding'] {
  const theme = mergeTheme(
    DEFAULT_TENANT_THEME,
    (tenant?.branding?.theme ?? {}) as Parameters<typeof mergeTheme>[1],
  )
  return {
    logo: tenant?.branding?.logo ?? '',
    discordServerInviteLink: tenant?.branding?.discordServerInviteLink ?? '',
    theme,
  }
}

export function useAdminForm(subscriptions: Record<string, { periodEnd?: string } | null>) {
  const tenantStore = useTenantStore()
  const apiBase = useApiBase()
  const tenant = computed(() => tenantStore.tenant)
  const slug = computed(() => tenantStore.slug)

  const moduleIds = computed(() => Object.keys(MODULE_NAV))

  const form = reactive<AdminForm>({
    name: '',
    description: '',
    branding: buildBrandingForm(null),
    modulesById: {},
  })

  const saving = ref(false)
  const saveError = ref<string | null>(null)

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
        moduleIds.value.map((id) => [id, (mods[id]?.state ?? 'off') as ModuleState]),
      )
    },
    { immediate: true },
  )

  async function save() {
    if (!slug.value) return
    saving.value = true
    saveError.value = null
    try {
      const prevMods = tenant.value?.modules ?? {}
      const modules: Record<
        string,
        { state: ModuleState; deactivatedate: string | null; deactivatingUntil: string | null; settingsjson: Record<string, unknown> }
      > = {}
      for (const id of moduleIds.value) {
        const prev = prevMods[id] as
          | {
              state?: ModuleState
              deactivatedate?: string | null
              deactivatingUntil?: string | null
              settingsjson?: Record<string, unknown>
            }
          | undefined
        const state = id === 'admin' ? 'active' : (form.modulesById[id] ?? 'off')
        let deactivatingUntil = prev?.deactivatingUntil ?? null
        if (state === 'deactivating' && prev?.state === 'active') {
          deactivatingUntil =
            subscriptions[id]?.periodEnd ?? prev?.deactivatedate ?? null
        }
        modules[id] = {
          state: state as ModuleState,
          deactivatedate: prev?.deactivatedate ?? null,
          deactivatingUntil,
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
            discordServerInviteLink: form.branding.discordServerInviteLink || undefined,
            theme: form.branding.theme,
          },
          modules,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        const msg =
          data.error ??
          (res.status === 503
            ? 'API cannot persist (set DATABASE_URL or TENANT_CONFIG_PATH).'
            : 'Failed to save')
        throw new Error(msg)
      }
      const data = (await res.json()) as { tenant: TenantConfig }
      tenantStore.setTenant(data.tenant)
      useThemeStore().loadTheme(data.tenant.branding?.theme ?? {}, data.tenant.branding)
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving.value = false
    }
  }

  return {
    form,
    tenant,
    slug,
    moduleIds,
    saving,
    saveError,
    save,
    buildBrandingForm,
  }
}
