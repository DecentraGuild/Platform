import {
  ConnectorClient,
  getDefaultConfig,
  createTransactionSigner,
  isConnected,
  type ConnectorState,
  type WalletConnectorId,
  type Wallet,
  type WalletAccount,
} from '@solana/connector/headless'

export interface ConnectorStateSnapshot {
  connected: boolean
  account: string | null
  connectorId: string | null
  connectors: { id: string; name: string; ready: boolean }[]
}

let clientInstance: ConnectorClient | null = null

function getClient(): ConnectorClient {
  if (!clientInstance) {
    clientInstance = new ConnectorClient(
      getDefaultConfig({
        appName: 'DecentraGuild',
        autoConnect: true,
      })
    )
  }
  return clientInstance
}

export function getConnectorClient(): ConnectorClient {
  return getClient()
}

export function getConnectorState(): ConnectorStateSnapshot {
  const client = getClient()
  const state = client.getSnapshot()
  const wallet = state.wallet
  const connected = isConnected(wallet)
  const session = connected ? wallet.session : null
  const account = session?.selectedAccount?.address ?? null
  const connectorId = session?.connectorId ?? null
  const connectors = (state.connectors ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    ready: c.ready ?? true,
  }))
  return {
    connected: connected && !!account,
    account,
    connectorId,
    connectors,
  }
}

export function subscribeToConnectorState(listener: (state: ConnectorState) => void): () => void {
  const client = getClient()
  return client.subscribe(listener)
}

export async function connectWallet(connectorId: WalletConnectorId): Promise<void> {
  const client = getClient()
  await client.connectWallet(connectorId)
}

export async function disconnectWallet(): Promise<void> {
  const client = getClient()
  await client.disconnectWallet()
}

function getWalletAndAccount(client: ConnectorClient): { wallet: Wallet; account: WalletAccount } | null {
  const state = client.getSnapshot()
  const walletStatus = state.wallet
  if (!isConnected(walletStatus)) return null
  const session = walletStatus.session
  const connectorId = session.connectorId
  const selectedAccount = session.selectedAccount
  if (!selectedAccount) return null
  const wallet = client.getConnector(connectorId)
  if (!wallet) return null
  const walletAccount = wallet.accounts.find((a) => a.address === selectedAccount.address)
  if (!walletAccount) return null
  return { wallet, account: walletAccount }
}

/**
 * Sign a message with the currently connected wallet.
 * Returns the signature as base64 (for sending to POST /auth/verify).
 */
export async function signMessageForAuth(message: string): Promise<{ signature: string; message: string }> {
  const client = getClient()
  const pair = getWalletAndAccount(client)
  if (!pair) {
    throw new Error('Wallet not connected')
  }
  const signer = createTransactionSigner({
    wallet: pair.wallet,
    account: pair.account,
  })
  if (!signer?.signMessage) {
    throw new Error('Connected wallet does not support message signing')
  }
  const messageBytes = new TextEncoder().encode(message)
  const signatureBytes = await signer.signMessage(messageBytes)
  const signature =
    signatureBytes instanceof Uint8Array
      ? btoa(String.fromCharCode(...signatureBytes))
      : String(signatureBytes)
  return { signature, message }
}
