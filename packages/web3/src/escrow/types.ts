import type { PublicKey } from '@solana/web3.js'
import type { Transaction, VersionedTransaction } from '@solana/web3.js'

/** Anchor-compatible wallet interface for escrow transactions */
export interface Wallet {
  publicKey: PublicKey
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
}
