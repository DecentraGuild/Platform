import { ref } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'
import {
  getConnectorState,
  connectWallet as web3ConnectWallet,
  signInWithWallet,
  signOut as web3SignOut,
  type ConnectorStateSnapshot,
} from '@decentraguild/web3'
import type { WalletConnectorId } from '@solana/connector/headless'

function normalizeApiBase(url: string): string {
  return (url ?? '').replace(/\/$/, '')
}

export function useAuth() {
  const config = useRuntimeConfig()
  const apiUrl = normalizeApiBase(config.public.apiUrl as string)

  const wallet = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const connectorState = ref<ConnectorStateSnapshot>({
    connected: false,
    account: null,
    connectorId: null,
    connectors: [],
  })

  async function fetchMe() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/me`, { credentials: 'include' })
      if (!res.ok) {
        wallet.value = null
        return
      }
      const data = (await res.json()) as { wallet: string }
      wallet.value = data.wallet
    } catch {
      wallet.value = null
    } finally {
      loading.value = false
    }
  }

  function refreshConnectorState() {
    connectorState.value = getConnectorState()
  }

  async function connectAndSignIn(connectorId: WalletConnectorId) {
    error.value = null
    loading.value = true
    try {
      await web3ConnectWallet(connectorId)
      refreshConnectorState()
      const result = await signInWithWallet(apiUrl, connectorId)
      if (!result.ok) {
        error.value = result.error
        return false
      }
      await fetchMe()
      return true
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    await web3SignOut(apiUrl)
    wallet.value = null
    error.value = null
    refreshConnectorState()
  }

  return {
    wallet,
    loading,
    error,
    connectorState,
    fetchMe,
    refreshConnectorState,
    connectAndSignIn,
    signOut,
  }
}
