/**
 * Resolves tenant slug from request host during SSR and fetches tenant context
 * so first paint has full branding/nav. Avoids client waterfall and hydration mismatch.
 */
import type { TenantConfig, MarketplaceSettings } from '@decentraguild/core'
import { getTenantSlugFromHost } from '@decentraguild/core'
import { useTenantStore } from '~/stores/tenant'
import { API_V1, normalizeApiBase } from '~/utils/apiBase'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const devDefaultSlug = (config.public.devTenantSlug as string)?.trim() || ''

  const event = useRequestEvent()
  const req = event?.node?.req
  if (!req?.headers?.host) return

  const host = (req.headers.host as string).toLowerCase()
  const url = req.url ?? ''
  const parsed = new URL(url.startsWith('/') ? `http://${host}${url}` : url)
  const searchParams = parsed.searchParams
  const singleHost = ((config.public as { tenantSingleHost?: string }).tenantSingleHost ?? 'dapp.dguild.org').toLowerCase()
  const isSingleHost = singleHost && host === singleHost
  const hasTenantInQuery = Boolean(searchParams.get('tenant')?.trim())

  // On the single-host entry (e.g. dapp.dguild.org), tenant must come from ?tenant=.
  // If the request has no query param, do not set slug from host (would be "dapp"); let the client use cached last tenant.
  if (isSingleHost && !hasTenantInQuery) return

  let slug = getTenantSlugFromHost(host, searchParams)
  if (!slug && (host.includes('localhost') || host.includes('127.0.0.1')) && devDefaultSlug) {
    slug = devDefaultSlug
  }

  if (!slug) return

  const tenantStore = useTenantStore()
  tenantStore.setSlug(slug)

  const apiBase = normalizeApiBase(config.public.apiUrl as string)
  const contextUrl = `${apiBase}${API_V1}/tenant-context?slug=${encodeURIComponent(slug)}`

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
