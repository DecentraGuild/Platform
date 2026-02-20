/**
 * RPC config for Solana. Requires NUXT_PUBLIC_HELIUS_RPC for marketplace.
 * Public mainnet RPC returns 403; we do not fall back to it for marketplace operations.
 */
export function useRpc() {
  const config = useRuntimeConfig()
  const heliusRpc = (config.public.heliusRpc as string)?.trim() ?? ''
  const hasRpc = heliusRpc.length > 0
  const rpcUrl = computed(() => (hasRpc ? heliusRpc.replace(/\/$/, '') : ''))
  const rpcError = computed(() =>
    !hasRpc
      ? 'Set NUXT_PUBLIC_HELIUS_RPC in your environment. The public Solana RPC returns 403 and cannot be used.'
      : null
  )
  return { rpcUrl, hasRpc, rpcError }
}
