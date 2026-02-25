/**
 * Explorer link builders from runtime config (tx, account, token).
 * Defaults: Solscan. Override via NUXT_PUBLIC_EXPLORER_TX_URL, _ACCOUNT_URL, _TOKEN_URL.
 */
export function useExplorerLinks() {
  const config = useRuntimeConfig()
  const txBase = (config.public.explorerTxUrl as string) || 'https://solscan.io/tx'
  const accountBase = (config.public.explorerAccountUrl as string) || 'https://solscan.io/account'
  const tokenBase = (config.public.explorerTokenUrl as string) || 'https://solscan.io/token'

  return {
    txUrl: (signature: string) => `${txBase.replace(/\/$/, '')}/${signature}`,
    accountUrl: (address: string) => `${accountBase.replace(/\/$/, '')}/${address}`,
    tokenUrl: (mint: string) => `${tokenBase.replace(/\/$/, '')}/${mint}`,
  }
}
