import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TenantConfig, MarketplaceSettings } from '@decentraguild/core'
import { useThemeStore } from '@decentraguild/ui'
import { API_V1, normalizeApiBase } from '~/utils/apiBase'

export type { MarketplaceSettings } from '@decentraguild/core'

export const useTenantStore = defineStore('tenant', () => {
  const tenant = ref<TenantConfig | null>(null)
  const marketplaceSettings = ref<MarketplaceSettings | null>(null)
  /** Route identifier from URL (subdomain or ?tenant=). Can be id (dg_xxx) or slug. API accepts both. */
  const slug = ref<string | null>(null)
  /** Canonical tenant id when tenant is loaded. Use for display of permanent identity. */
  const tenantId = computed(() => tenant.value?.id ?? null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTenantContext(slugParam: string) {
    loading.value = true
    error.value = null
    slug.value = slugParam
    marketplaceSettings.value = null

    const config = useRuntimeConfig()
    const apiBase = normalizeApiBase(config.public.apiUrl as string) // same formula as useApiBase()
    const url = `${apiBase}${API_V1}/tenant-context?slug=${slugParam}`
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data.error as string) || `HTTP ${res.status}`
        throw new Error(`${msg} (${url})`)
      }
      const data = await res.json()
      applyTenantContext(slugParam, {
        tenant: data.tenant as TenantConfig,
        marketplaceSettings: (data.marketplaceSettings as MarketplaceSettings) ?? null,
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load tenant'
      tenant.value = null
      marketplaceSettings.value = null
    } finally {
      loading.value = false
    }
  }

  /** Re-fetch tenant context for current slug (e.g. after cron may have changed module state). */
  async function refetchTenantContext() {
    const currentSlug = slug.value
    if (!currentSlug) return
    await fetchTenantContext(currentSlug)
  }

  function clearTenant() {
    tenant.value = null
    marketplaceSettings.value = null
    slug.value = null
    error.value = null
  }

  function setTenant(config: TenantConfig | null) {
    tenant.value = config
  }

  function setMarketplaceSettings(settings: MarketplaceSettings | null) {
    marketplaceSettings.value = settings
  }

  function setSlug(slugParam: string | null) {
    slug.value = slugParam
  }

  /** Apply fetched tenant context (used by SSR and after fetch). No document access. */
  function applyTenantContext(slugParam: string, data: { tenant: TenantConfig; marketplaceSettings?: MarketplaceSettings | null }) {
    slug.value = slugParam
    tenant.value = data.tenant
    marketplaceSettings.value = data.marketplaceSettings ?? null
    error.value = null
    const themeStore = useThemeStore()
    themeStore.loadTheme(data.tenant.branding?.theme ?? {}, {
      logo: data.tenant.branding?.logo,
      name: data.tenant.branding?.name,
      shortName: data.tenant.branding?.shortName,
    })
  }

  return {
    tenant,
    tenantId,
    marketplaceSettings,
    slug,
    loading,
    error,
    fetchTenantContext,
    refetchTenantContext,
    applyTenantContext,
    clearTenant,
    setTenant,
    setMarketplaceSettings,
    setSlug,
  }
})
