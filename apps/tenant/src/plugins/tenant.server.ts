/**
 * Resolves tenant slug from request host during SSR and fetches tenant context
 * so first paint has full branding/nav. Avoids client waterfall and hydration mismatch.
 */
import type { TenantConfig } from '@decentraguild/core'
import { getTenantSlugFromHost } from '@decentraguild/core'
import { useTenantStore } from '~/stores/tenant'
import type { MarketplaceSettings } from '~/stores/tenant'
import { normalizeApiBase } from '~/utils/apiBase'

const DEV_DEFAULT_TENANT = 'skull'

export default defineNuxtPlugin(async () => {
  const event = useRequestEvent()
  const req = event?.node?.req
  if (!req?.headers?.host) return

  const host = req.headers.host as string
  const url = req.url ?? ''
  const parsed = new URL(url.startsWith('/') ? `http://${host}${url}` : url)
  const searchParams = parsed.searchParams
  let slug = getTenantSlugFromHost(host, searchParams)
  if (!slug && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    slug = DEV_DEFAULT_TENANT
  }

  if (!slug) return

  const tenantStore = useTenantStore()
  tenantStore.setSlug(slug)

  const config = useRuntimeConfig()
  const apiBase = normalizeApiBase(config.public.apiUrl as string)
  const contextUrl = `${apiBase}/api/v1/tenant-context?slug=${encodeURIComponent(slug)}`

  try {
    const data = await $fetch<{ tenant: TenantConfig; marketplaceSettings?: MarketplaceSettings | null }>(
      contextUrl,
      { headers: { Accept: 'application/json' } }
    )
    if (data?.tenant) {
      tenantStore.applyTenantContext(slug, {
        tenant: data.tenant,
        marketplaceSettings: data.marketplaceSettings ?? null,
      })
    }
  } catch {
    tenantStore.error = 'Failed to load tenant'
  }
})
