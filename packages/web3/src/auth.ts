import { getConnectorState, signMessageForAuth, disconnectWallet } from './connector.js'
import type { WalletConnectorId } from '@solana/connector/headless'

export interface AuthSignInResult {
  ok: true
}

export interface AuthSignInError {
  ok: false
  error: string
}

/**
 * Request nonce from API, sign with connected wallet, verify and set session cookie.
 * Caller must have connected a wallet first (connectWallet(connectorId)).
 */
export async function signInWithWallet(
  apiBaseUrl: string,
  _connectorId: WalletConnectorId // Required by caller API; used for future multi-wallet
): Promise<AuthSignInResult | AuthSignInError> {
  const state = getConnectorState()
  if (!state.connected || !state.account) {
    return { ok: false, error: 'Wallet not connected' }
  }
  const base = apiBaseUrl.replace(/\/$/, '')
  try {
    const nonceRes = await fetch(`${base}/api/v1/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: state.account }),
      credentials: 'include',
    })
    if (!nonceRes.ok) {
      const data = await nonceRes.json().catch(() => ({}))
      return { ok: false, error: (data.error as string) ?? 'Failed to get nonce' }
    }
    const { nonce } = (await nonceRes.json()) as { nonce: string }
    let signature: string
    let message: string
    try {
      const signed = await signMessageForAuth(nonce)
      signature = signed.signature
      message = signed.message
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to sign message',
      }
    }
    const verifyRes = await fetch(`${base}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: state.account,
        signature,
        message,
      }),
      credentials: 'include',
    })
    if (!verifyRes.ok) {
      const data = await verifyRes.json().catch(() => ({}))
      return { ok: false, error: (data.error as string) ?? 'Verification failed' }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: msg.includes('fetch') ? 'Cannot reach server. Is the API running?' : msg }
  }
}

export async function signOut(apiBaseUrl: string): Promise<void> {
  const base = apiBaseUrl.replace(/\/$/, '')
  await fetch(`${base}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  await disconnectWallet()
}

export {
  getConnectorState,
  subscribeToConnectorState,
  connectWallet,
  disconnectWallet,
  getConnectorClient,
  type ConnectorStateSnapshot,
} from './connector.js'
