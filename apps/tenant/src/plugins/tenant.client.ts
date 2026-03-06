/**
 * Ensures tenant context for current tenant (id or slug from URL/subdomain).
 * On single host (e.g. dapp.dguild.org) we use tenant ID in URL and cache so
 * subscription and ops are keyed by id; slug is display-only and can change.
 */
import { getTenantSlugFromHost } from '@decentraguild/core'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_NAV, IMPLEMENTED_MODULES } from '~/config/modules'

const MODULE_PATHS = Array.from(IMPLEMENTED_MODULES)
  .map((id) => MODULE_NAV[id]?.path)
  .filter((path): path is string => Boolean(path))

const LAST_TENANT_STORAGE_KEY = 'dg_last_tenant'

function getCachedTenantId(): string | null {
  if (import.meta.server || typeof localStorage === 'undefined') return null
  try {
    const s = localStorage.getItem(LAST_TENANT_STORAGE_KEY)
    return s?.trim() || null
  } catch {
    return null
  }
}

function setCachedTenantId(tenantId: string): void {
  if (import.meta.server || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LAST_TENANT_STORAGE_KEY, tenantId)
  } catch {
    /* ignore */
  }
}

/** Tenant param from URL (id or slug). On single host with no param, uses cached tenant id. */
function getTenantParamFromUrl(): string | null {
  if (import.meta.server) return null
  const config = useRuntimeConfig()
  const devDefaultSlug = (config.public.devTenantSlug as string)?.trim() || ''
  const singleHost = ((config.public as { tenantSingleHost?: string }).tenantSingleHost ?? 'dapp.dguild.org').toLowerCase()
  const host = window.location.hostname.toLowerCase()
  const searchParams = new URL(window.location.href).searchParams
  const queryParam = searchParams.get('tenant')?.trim() || null

  if (queryParam) return queryParam

  const isSingleHost = singleHost && host === singleHost
  if (isSingleHost) {
    const cached = getCachedTenantId()
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
    if (t?.id) setCachedTenantId(t.id)
  }

  const searchParams = new URL(window.location.href).searchParams
  const tenantFromUrl = searchParams.get('tenant')?.trim() || null
  const isNewOrgRedirect = Boolean(searchParams.get('new'))

  if (tenantFromUrl) {
    const current = tenantStore.tenant
    const match = current && (current.id === tenantFromUrl || current.slug === tenantFromUrl)
    if (!match) {
      tenantStore.clearTenant()
      tenantStore.setSlug(tenantFromUrl)
    }
  }

  const initialParam = getTenantParamFromUrl()
  await ensureTenantContext(initialParam)
  persistTenantToCache()

  const singleHost = ((config.public as { tenantSingleHost?: string }).tenantSingleHost ?? 'dapp.dguild.org').toLowerCase()
  const host = window.location.hostname.toLowerCase()
  const isSingleHost = singleHost && host === singleHost
  const tenantIdForUrl = tenantStore.tenantId ?? tenantStore.slug

  if (isSingleHost && tenantIdForUrl && router) {
    const currentQuery = route.query?.tenant
    if (currentQuery !== tenantIdForUrl) {
      router.replace({ path: route.path, query: { ...route.query, tenant: tenantIdForUrl } })
    }
  }

  if (isNewOrgRedirect && router && tenantIdForUrl) {
    const q = { ...route.query }
    delete q.new
    router.replace({ path: route.path, query: Object.keys(q).length ? q : undefined })
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
      const newParam = getTenantParamFromUrl()
      if (newParam && newParam !== tenantStore.slug && newParam !== tenantStore.tenantId) {
        tenantStore.setSlug(newParam)
        void ensureTenantContext(newParam)
      }
    }
  )

  watch(
    () => route.path,
    (newPath, oldPath) => {
      if (newPath !== oldPath && isModulePath(newPath) && (tenantStore.slug ?? tenantStore.tenantId)) {
        void tenantStore.refetchTenantContext()
      }
    }
  )

  if (pollSeconds > 0 && typeof document !== 'undefined') {
    let pollTimer: ReturnType<typeof setInterval> | null = null
    function startPoll() {
      if (pollTimer) return
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && (tenantStore.slug ?? tenantStore.tenantId) && isModulePath(route.path)) {
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
