/**
 * Whether to append ?tenant= to internal links and share URLs.
 * When the tenant is already encoded in the host (subdomain, e.g. your-slug.dguild.org),
 * we do not add ?tenant= to avoid redundant URLs like your-slug.dguild.org/market?tenant=your-slug.
 * When the app is served from the single-tenant host (e.g. dapp.dguild.org), we must add
 * ?tenant= so the next navigation still resolves the tenant.
 */
import { getTenantSlugFromHost } from '@decentraguild/core'
import { useTenantStore } from '~/stores/tenant'

export function useTenantInLinks() {
  const tenantStore = useTenantStore()

  const shouldAppendTenantToLinks = computed(() => {
    const slug = tenantStore.slug
    if (!slug) return false

    let host = ''
    if (import.meta.client && typeof window !== 'undefined') {
      host = window.location.host
    } else {
      const event = useRequestEvent()
      host = (event?.node?.req?.headers?.host as string) ?? ''
    }

    if (!host) return true

    const slugFromHost = getTenantSlugFromHost(host, undefined)
    return slugFromHost !== slug
  })

  return { shouldAppendTenantToLinks }
}
