import { getTenantSlugFromHost } from '@decentraguild/core'
import { useTenantStore } from '~/stores/tenant'

const DEV_DEFAULT_TENANT = 'skull'

export default defineNuxtPlugin(async () => {
  if (import.meta.server) return

  const host = window.location.hostname
  const searchParams = new URL(window.location.href).searchParams
  let slug = getTenantSlugFromHost(host, searchParams)
  if (!slug && (host === 'localhost' || host === '127.0.0.1')) {
    slug = DEV_DEFAULT_TENANT
  }

  if (slug) {
    const tenantStore = useTenantStore()
    await tenantStore.fetchTenantContext(slug)
  }
})
