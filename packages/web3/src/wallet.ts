/**
 * Wallet + auth only. No escrow/spl-token.
 * Use this for platform app, admin, any consumer that only needs connect + sign in.
 * Import escrow separately when needed (e.g. marketplace).
 */
export {
  getConnectorClient,
  getConnectorState,
  subscribeToConnectorState,
  connectWallet,
  disconnectWallet,
  signMessageForAuth,
  getWalletAndAccount,
  getEscrowWalletFromConnector,
  type ConnectorStateSnapshot,
} from './connector.js'

export {
  signInWithWallet,
  signOut,
  type AuthSignInResult,
  type AuthSignInError,
} from './auth.js'
