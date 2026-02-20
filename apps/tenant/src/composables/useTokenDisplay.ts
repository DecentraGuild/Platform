/**
 * Resolves mint + raw amount to display-ready data (formatted amount, symbol, name, decimals).
 * Uses useMintMetadata (API first, RPC fallback on 404).
 */
import { fromRawUnits, truncateAddress } from '@decentraguild/display'

export interface TokenDisplayData {
  formattedAmount: string
  decimals: number | null
  symbol: string | null
  name: string | null
  mintShort: string
  loading: boolean
  error: string | null
}

export function useTokenDisplay(
  mint: import('vue').Ref<string | null>,
  rawAmount?: import('vue').Ref<string | { toString: () => string } | null>
) {
  const { fetchMetadata } = useMintMetadata()

  const metadata = ref<{ name: string; symbol: string; decimals: number } | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const decimals = computed(() => metadata.value?.decimals ?? null)
  const symbol = computed(() => metadata.value?.symbol ?? null)
  const name = computed(() => metadata.value?.name ?? null)
  const mintShort = computed(() => truncateAddress(mint.value, 6, 4))

  const humanAmount = computed(() => {
    const amt = rawAmount?.value
    const dec = decimals.value ?? 0
    if (!amt || !mint.value) return 0
    return fromRawUnits(amt, dec)
  })

  /** Raw number string until a new formatter is added. */
  const formattedAmount = computed(() => {
    const n = humanAmount.value
    if (!Number.isFinite(n)) return '0'
    return Number.isInteger(n) ? String(n) : n.toFixed(6).replace(/\.?0+$/, '')
  })

  const data = computed<TokenDisplayData>(() => ({
    formattedAmount: formattedAmount.value,
    decimals: decimals.value,
    symbol: symbol.value ?? null,
    name: name.value ?? null,
    mintShort: mintShort.value,
    loading: loading.value,
    error: error.value,
  }))

  async function load() {
    const m = mint.value
    if (!m) {
      loading.value = false
      return
    }
    loading.value = true
    error.value = null
    try {
      const meta = await fetchMetadata(m)
      metadata.value = meta ? { name: meta.name, symbol: meta.symbol, decimals: meta.decimals } : null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load metadata'
    } finally {
      loading.value = false
    }
  }

  watch(mint, load, { immediate: true })

  return { data, load }
}
