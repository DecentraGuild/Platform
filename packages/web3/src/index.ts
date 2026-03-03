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

export {
  buildInitializeTransaction,
  buildCancelTransaction,
  buildExchangeTransaction,
  sendAndConfirmTransaction,
  fetchEscrowByAddress,
  fetchAllEscrows,
  deriveEscrowAccounts,
  addMakerFeeInstructions,
  calculateTakerFee,
  isWrappedSol,
  getWrappedSolAccount,
  FEE_CONFIG,
  TRANSACTION_COSTS,
  RPC_ESCROW_FETCH_TIMEOUT_MS,
} from './escrow/index.js'
export type {
  BuildInitializeParams,
  BuildCancelParams,
  BuildExchangeParams,
  SendAndConfirmOptions,
  ShopFee,
  Wallet as EscrowWallet,
  EscrowAccount,
  EscrowWithAddress,
} from './escrow/index.js'

export { createConnection } from './connection.js'
export {
  getDasRpcUrl,
  dasRequest,
  fetchAsset,
  fetchAssetsByGroup,
} from './das/index.js'
export type { DasAsset, DasAttribute } from './das/index.js'

export { fetchMintMetadataFromChain } from './mint-metadata.js'
export type { FetchedMintMetadata } from './mint-metadata.js'

export {
  buildBillingTransfer,
  USDC_MINT,
  USDC_DECIMALS,
} from './billing/transfer.js'
export type { BuildBillingTransferParams } from './billing/transfer.js'

export {
  deriveWhitelistPda,
  deriveWhitelistEntryPda,
  getWhitelistProgram,
  getWhitelistProgramReadOnly,
  fetchWhitelist,
  fetchAllWhitelistsByAuthority,
  fetchWhitelistEntries,
  isWalletOnWhitelist,
  buildInitializeWhitelistTransaction,
  buildAddToWhitelistTransaction,
  buildRemoveFromWhitelistTransaction,
  buildDeleteWhitelistTransaction,
} from './whitelist/index.js'
export type {
  WhitelistAccount,
  WhitelistEntryAccount,
  WhitelistWithAddress,
  WhitelistEntryWithAddress,
  BuildInitializeWhitelistParams,
  BuildAddToWhitelistParams,
  BuildRemoveFromWhitelistParams,
  BuildDeleteWhitelistParams,
} from './whitelist/index.js'

export {
  deriveRafflePda,
  deriveTicketsPda,
  deriveTicketVaultPda,
  derivePrizeVaultPda,
  getRaffleProgram,
  getRaffleProgramReadOnly,
  buildInitializeRaffleTransaction,
  buildPrepareRaffleTransaction,
  buildCloseRaffleTransaction,
  buildEnableRaffleTransaction,
  buildDisableRaffleTransaction,
  buildEditRaffleTransaction,
  buildRevealWinnersTransaction,
  buildClaimPrizeTransaction,
  buildClaimTicketsTransaction,
  buildBuyTicketsTransaction,
  fetchRaffleChainData,
  isRaffleVisibleToUsers,
  USER_VISIBLE_STATES,
} from './raffle/index.js'
export type {
  BuildInitializeRaffleParams,
  BuildPrepareRaffleParams,
  BuildBuyTicketsParams,
  RaffleChainData,
  RaffleState,
} from './raffle/index.js'
