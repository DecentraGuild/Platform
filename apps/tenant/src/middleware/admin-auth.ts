import { useAuth } from '@decentraguild/auth'

function homeWithTenantQuery(slug: string | null) {
  return slug ? { path: '/', query: { tenant: slug } } : '/'
}

export default defineNuxtRouteMiddleware(async (_to) => {
  const tenantStore = useTenantStore()
  const slug = tenantStore.slug

  // Server: never render /admin (auth is client-side). Redirect so client loads home; preserve tenant query.
  if (import.meta.server) {
    return navigateTo(homeWithTenantQuery(slug), { replace: true })
  }
  const auth = useAuth()
  if (!tenantStore.tenant || !slug) {
    return navigateTo(homeWithTenantQuery(slug), { replace: true })
  }
  const wallet = auth.wallet.value
  if (!wallet) {
    return navigateTo(homeWithTenantQuery(slug), { replace: true })
  }
  const admins = tenantStore.tenant.admins ?? []
  if (!admins.includes(wallet)) {
    return navigateTo(homeWithTenantQuery(slug), { replace: true })
  }
})
