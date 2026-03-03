import type { Ref } from 'vue'
import { toRawUnits } from '@decentraguild/display'
import { useMintMetadata } from '~/composables/useMintMetadata'

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * Composable for form inputs that need mint metadata (decimals, symbol).
 * Watches mint ref, fetches metadata, and provides label, placeholder, hint, toRawAmount.
 * Use for ticket price, prize amount, etc.
 */
export function useMintMetadataForInput(
  mint: Ref<string>,
  amountDisplay: Ref<string>,
  options: { fieldLabel?: string } = {}
) {
  const { fieldLabel = 'Amount' } = options
  const { fetchMetadata } = useMintMetadata()

  const metadata = ref<{ decimals: number; symbol?: string; name?: string } | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  watch(
    () => mint.value.trim(),
    async (m) => {
      metadata.value = null
      error.value = null
      if (!m || !BASE58_REGEX.test(m)) return
      loading.value = true
      try {
        const meta = await fetchMetadata(m)
        if (meta) {
          metadata.value = { decimals: meta.decimals, symbol: meta.symbol, name: meta.name }
        } else {
          error.value = 'Could not load decimals'
        }
      } catch {
        error.value = 'Could not load decimals'
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  const label = computed(() => {
    const m = metadata.value
    if (m) {
      const parts = m.symbol ? [m.symbol, `${m.decimals} decimals`] : [`${m.decimals} decimals`]
      return `${fieldLabel} (${parts.join(', ')})`
    }
    return fieldLabel
  })

  const placeholder = computed(() => {
    if (metadata.value) return 'e.g. 1'
    if (loading.value) return 'Loading...'
    return 'Enter mint address first'
  })

  const hint = computed(() => {
    if (loading.value) return 'Fetching token metadata...'
    if (error.value) return 'Decimals unknown – enter base units if needed'
    if (metadata.value) {
      return `${metadata.value.decimals} decimals – type human amount (e.g. 1 for 1 ${metadata.value.symbol ?? 'token'})`
    }
    return `Enter the ${fieldLabel.toLowerCase()} token mint above to load decimals`
  })

  function toRawAmount(): string {
    const dec = metadata.value?.decimals
    const num = parseFloat(amountDisplay.value) || 0
    if (dec != null) return toRawUnits(num, dec)
    return String(Math.max(0, Math.floor(num)))
  }

  return {
    metadata,
    loading,
    error,
    label,
    placeholder,
    hint,
    toRawAmount,
  }
}
