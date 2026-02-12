export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return
  const auth = useAuth()
  const tenantStore = useTenantStore()
  if (!tenantStore.tenant || !tenantStore.slug) {
    return navigateTo('/')
  }
  const wallet = auth.wallet.value
  if (!wallet) {
    return navigateTo('/')
  }
  const admins = tenantStore.tenant.admins ?? []
  if (!admins.includes(wallet)) {
    return navigateTo('/')
  }
})
