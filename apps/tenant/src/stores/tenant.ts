import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TenantConfig } from '@decentraguild/core'
import { useThemeStore } from '@decentraguild/ui'
import { normalizeApiBase } from '~/utils/apiBase'

/** 0..3 group labels for flexible tree levels under Type. Max 3 in v1. */
export type MarketplaceGroupPath = string[]

export interface MarketplaceSettings {
  collectionMints: Array<{ mint: string; name?: string; image?: string; sellerFeeBasisPoints?: number; groupPath?: MarketplaceGroupPath }>
  splAssetMints?: Array<{ mint: string; name?: string; symbol?: string; decimals?: number; groupPath?: MarketplaceGroupPath }>
  currencyMints: Array<{ mint: string; name: string; symbol: string; decimals?: number; groupPath?: MarketplaceGroupPath }>
  whitelist?: { programId: string; account: string }
  shopFee: { wallet: string; makerFlatFee: number; takerFlatFee: number; makerPercentFee: number; takerPercentFee: number }
}

export const useTenantStore = defineStore('tenant', () => {
  const tenant = ref<TenantConfig | null>(null)
  const marketplaceSettings = ref<MarketplaceSettings | null>(null)
  const slug = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTenantContext(slugParam: string) {
    loading.value = true
    error.value = null
    slug.value = slugParam
    marketplaceSettings.value = null

    const config = useRuntimeConfig()
    const apiBase = normalizeApiBase(config.public.apiUrl as string)
    const url = `${apiBase}/api/v1/tenant-context?slug=${slugParam}`
    try {
      const res = await fetch(url)
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
    marketplaceSettings,
    slug,
    loading,
    error,
    fetchTenantContext,
    applyTenantContext,
    clearTenant,
    setTenant,
    setMarketplaceSettings,
    setSlug,
  }
})
