/**
 * Ensures tenant context for current slug. On hydration after SSR, we may already
 * have data. On client-side tenant switch (subdomain change or ?tenant= in path),
 * we fetch the new tenant. Users can be in multiple dGuilds or visit public
 * modules of other dGuilds; switching happens via subdomain or tenant path click.
 */
import { getTenantSlugFromHost } from '@decentraguild/core'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'

function getSlugFromUrl(): string | null {
  if (import.meta.server) return null
  const config = useRuntimeConfig()
  const devDefaultSlug = (config.public.devTenantSlug as string) || 'skull'
  const host = window.location.hostname
  const searchParams = new URL(window.location.href).searchParams
  let slug = getTenantSlugFromHost(host, searchParams)
  if (!slug && (host === 'localhost' || host === '127.0.0.1')) {
    slug = devDefaultSlug
  }
  return slug
}

export default defineNuxtPlugin(async () => {
  if (import.meta.server) return

  const tenantStore = useTenantStore()
  const themeStore = useThemeStore()
  const route = useRoute()

  async function ensureTenantContext(slug: string | null) {
    if (!slug) return
    if (tenantStore.tenant?.slug === slug) return
    await tenantStore.fetchTenantContext(slug)
  }

  const initialSlug = getSlugFromUrl()
  await ensureTenantContext(initialSlug)

  themeStore.applyThemeToDocument()

  watch(
    () => [route.fullPath, route.query?.tenant],
    () => {
      const newSlug = getSlugFromUrl()
      if (newSlug && newSlug !== tenantStore.slug) {
        tenantStore.setSlug(newSlug)
        void ensureTenantContext(newSlug)
      }
    }
  )
})
