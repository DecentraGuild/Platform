/**
 * Ensures tenant context for current slug. On hydration after SSR, we may already
 * have data. On client-side tenant switch (subdomain change or ?tenant= in path),
 * we fetch the new tenant. Refetches when navigating to a module route so module
 * state (e.g. after cron) is fresh. Optional 60s poll when on a module page and
 * tab visible (configurable via NUXT_PUBLIC_TENANT_CONTEXT_POLL_SECONDS, 0 = off).
 * On the single host (e.g. dapp.dguild.org), when URL has no ?tenant= we use
 * the last-visited tenant from localStorage so refresh keeps the same org.
 */
import { getTenantSlugFromHost } from '@decentraguild/core'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_NAV, IMPLEMENTED_MODULES } from '~/config/modules'

const MODULE_PATHS = Array.from(IMPLEMENTED_MODULES)
  .map((id) => MODULE_NAV[id]?.path)
  .filter((path): path is string => Boolean(path))

const LAST_TENANT_STORAGE_KEY = 'dg_last_tenant'

function getCachedTenantSlug(): string | null {
  if (import.meta.server || typeof localStorage === 'undefined') return null
  try {
    const s = localStorage.getItem(LAST_TENANT_STORAGE_KEY)
    return s?.trim() || null
  } catch {
    return null
  }
}

function setCachedTenantSlug(slug: string): void {
  if (import.meta.server || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LAST_TENANT_STORAGE_KEY, slug)
  } catch {
    /* ignore */
  }
}

function getSlugFromUrl(): string | null {
  if (import.meta.server) return null
  const config = useRuntimeConfig()
  const devDefaultSlug = (config.public.devTenantSlug as string)?.trim() || ''
  const singleHost = ((config.public as { tenantSingleHost?: string }).tenantSingleHost ?? 'dapp.dguild.org').toLowerCase()
  const host = window.location.hostname.toLowerCase()
  const searchParams = new URL(window.location.href).searchParams
  const querySlug = searchParams.get('tenant')?.trim() || null

  if (querySlug) return querySlug

  const isSingleHost = singleHost && host === singleHost
  if (isSingleHost) {
    const cached = getCachedTenantSlug()
    if (cached) return cached
  }

  let slug = getTenantSlugFromHost(host, searchParams)
  if (!slug && (host === 'localhost' || host === '127.0.0.1') && devDefaultSlug) {
    slug = devDefaultSlug
  }
  return slug || null
}

function isModulePath(path: string): boolean {
  return MODULE_PATHS.some((p) => path === p || path.startsWith(p + '/'))
}

export default defineNuxtPlugin(async () => {
  if (import.meta.server) return

  const tenantStore = useTenantStore()
  const themeStore = useThemeStore()
  const route = useRoute()
  const router = useRouter()
  const config = useRuntimeConfig()
  const pollSeconds = Number((config.public as { tenantContextPollSeconds?: number }).tenantContextPollSeconds ?? 60)

  async function ensureTenantContext(slug: string | null) {
    if (!slug) return
    const tid = tenantStore.tenant?.id
    const match = tid === slug || tenantStore.tenant?.slug === slug
    if (match) return
    await tenantStore.fetchTenantContext(slug)
  }

  function persistTenantToCache() {
    const t = tenantStore.tenant
    const s = tenantStore.slug
    if (t && s) setCachedTenantSlug(t.slug ?? t.id)
  }

  const initialSlug = getSlugFromUrl()
  await ensureTenantContext(initialSlug)
  persistTenantToCache()

  // When on single host with no ?tenant= we used cache; sync URL so refresh keeps the tenant.
  const singleHost = ((config.public as { tenantSingleHost?: string }).tenantSingleHost ?? 'dapp.dguild.org').toLowerCase()
  const host = window.location.hostname.toLowerCase()
  const searchParams = new URL(window.location.href).searchParams
  if (singleHost && host === singleHost && !searchParams.get('tenant') && tenantStore.slug && router) {
    router.replace({ path: route.path, query: { ...route.query, tenant: tenantStore.slug } })
  }

  themeStore.applyThemeToDocument()

  watch(
    () => tenantStore.tenant,
    () => persistTenantToCache(),
    { deep: true }
  )

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
