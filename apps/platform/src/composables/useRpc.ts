/**
 * RPC URL for Solana. Uses NUXT_PUBLIC_HELIUS_RPC.
 */
export function useRpc() {
  const config = useRuntimeConfig()
  const heliusRpc = (config.public.heliusRpc as string)?.trim() ?? ''
  const rpcUrl = computed(() => (heliusRpc.length > 0 ? heliusRpc.replace(/\/$/, '') : ''))
  const hasRpc = computed(() => rpcUrl.value.length > 0)
  return { rpcUrl, hasRpc }
}
