import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TenantConfig } from '@decentraguild/core'
import { useThemeStore } from '@decentraguild/ui'

export const useTenantStore = defineStore('tenant', () => {
  const tenant = ref<TenantConfig | null>(null)
  const slug = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTenantContext(slugParam: string) {
    loading.value = true
    error.value = null
    slug.value = slugParam

    const config = useRuntimeConfig()
    const apiUrl = config.public.apiUrl

    const url = `${apiUrl}/api/v1/tenant-context?slug=${slugParam}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data.error as string) || `HTTP ${res.status}`
        throw new Error(`${msg} (${url})`)
      }
      const data = await res.json()
      tenant.value = data.tenant as TenantConfig

      const themeStore = useThemeStore()
      themeStore.loadTheme(
        tenant.value.branding?.theme ?? {},
        {
          logo: tenant.value.branding?.logo,
          name: tenant.value.branding?.name,
          shortName: tenant.value.branding?.shortName,
        }
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load tenant'
      tenant.value = null
    } finally {
      loading.value = false
    }
  }

  function clearTenant() {
    tenant.value = null
    slug.value = null
    error.value = null
  }

  function setTenant(config: TenantConfig | null) {
    tenant.value = config
  }

  return {
    tenant,
    slug,
    loading,
    error,
    fetchTenantContext,
    clearTenant,
    setTenant,
  }
})
