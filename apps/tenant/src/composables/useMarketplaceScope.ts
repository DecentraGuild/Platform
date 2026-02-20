export interface ScopeEntry {
  mint: string
  source: string
  collectionMint: string | null
}

const SCOPE_CACHE_TTL_MS = 60_000

const scopeCache = new Map<
  string,
  { mints: string[]; entries: ScopeEntry[]; fetchedAt: number }
>()

function getCachedScope(slug: string): { mints: string[]; entries: ScopeEntry[] } | null {
  const cached = scopeCache.get(slug)
  if (!cached) return null
  if (Date.now() - cached.fetchedAt > SCOPE_CACHE_TTL_MS) {
    scopeCache.delete(slug)
    return null
  }
  return { mints: cached.mints, entries: cached.entries }
}

function setCachedScope(slug: string, mints: string[], entries: ScopeEntry[]) {
  scopeCache.set(slug, { mints, entries, fetchedAt: Date.now() })
}

/**
 * Fetches marketplace scope mints for a tenant.
 * Used to filter escrows (depositToken/requestToken must be in scope).
 * entries: full list with collectionMint for aggregating collection counts.
 * Client-side cache: 60s TTL per slug to avoid refetch on navigation.
 */
export function useMarketplaceScope(slug: Ref<string | null>) {
  const apiBase = useApiBase()

  const mints = ref<string[]>([])
  const entries = ref<ScopeEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const s = slug.value
    if (!s) {
      mints.value = []
      entries.value = []
      return
    }

    const cached = getCachedScope(s)
    if (cached) {
      mints.value = cached.mints
      entries.value = cached.entries
      return
    }

    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${apiBase.value}/api/v1/tenant/${encodeURIComponent(s)}/marketplace/scope`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { mints?: string[]; entries?: ScopeEntry[] }
      const mintsList = Array.isArray(data.mints) ? data.mints : []
      const entriesList = Array.isArray(data.entries) ? data.entries : []
      mints.value = mintsList
      entries.value = entriesList
      setCachedScope(s, mintsList, entriesList)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load marketplace scope'
      mints.value = []
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  const mintsSet = computed(() => new Set(mints.value))

  /** Mints that belong to a collection (for aggregating counts). */
  const mintsByCollection = computed(() => {
    const map = new Map<string, string[]>()
    for (const e of entries.value) {
      if (e.collectionMint) {
        const list = map.get(e.collectionMint) ?? []
        list.push(e.mint)
        map.set(e.collectionMint, list)
      }
    }
    return map
  })

  watch(
    slug,
    (s) => {
      if (s) load()
      else {
        mints.value = []
        entries.value = []
        error.value = null
      }
    },
    { immediate: true }
  )

  return { mints, entries, mintsSet, mintsByCollection, loading, error, retry: load }
}
