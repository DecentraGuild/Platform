/**
 * Ensures tenant context for current slug. On hydration after SSR, we may already
 * have data. On client-side tenant switch (subdomain change or ?tenant= in path),
 * we fetch the new tenant. Refetches when navigating to a module route so module
 * state (e.g. after cron) is fresh. Optional 60s poll when on a module page and
 * tab visible (configurable via NUXT_PUBLIC_TENANT_CONTEXT_POLL_SECONDS, 0 = off).
 */
import { getTenantSlugFromHost } from '@decentraguild/core'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_NAV, IMPLEMENTED_MODULES } from '~/config/modules'

const MODULE_PATHS = Array.from(IMPLEMENTED_MODULES)
  .map((id) => MODULE_NAV[id]?.path)
  .filter((path): path is string => Boolean(path))

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

function isModulePath(path: string): boolean {
  return MODULE_PATHS.some((p) => path === p || path.startsWith(p + '/'))
}

export default defineNuxtPlugin(async () => {
  if (import.meta.server) return

  const tenantStore = useTenantStore()
  const themeStore = useThemeStore()
  const route = useRoute()
  const config = useRuntimeConfig()
  const pollSeconds = Number((config.public as { tenantContextPollSeconds?: number }).tenantContextPollSeconds ?? 60)

  async function ensureTenantContext(slug: string | null) {
    if (!slug) return
    const tid = tenantStore.tenant?.id
    const match = tid === slug || tenantStore.tenant?.slug === slug
    if (match) return
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

  watch(
    () => route.path,
    (newPath, oldPath) => {
      if (newPath !== oldPath && isModulePath(newPath) && tenantStore.slug) {
        void tenantStore.refetchTenantContext()
      }
    }
  )

  if (pollSeconds > 0 && typeof document !== 'undefined') {
    let pollTimer: ReturnType<typeof setInterval> | null = null
    function startPoll() {
      if (pollTimer) return
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && tenantStore.slug && isModulePath(route.path)) {
          void tenantStore.refetchTenantContext()
        }
      }, pollSeconds * 1000)
    }
    function stopPoll() {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }
    watch(
      () => route.path,
      () => {
        if (document.visibilityState === 'visible' && isModulePath(route.path)) {
          startPoll()
        } else {
          stopPoll()
        }
      },
      { immediate: true }
    )
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        stopPoll()
      } else if (isModulePath(route.path)) {
        startPoll()
      }
    })
  }
})
