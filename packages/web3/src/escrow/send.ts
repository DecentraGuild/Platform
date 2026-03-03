import type { Connection } from '@solana/web3.js'
import { Transaction, type PublicKey } from '@solana/web3.js'
import type { Wallet } from './types.js'

export interface SendAndConfirmOptions {
  /** Run simulation before sending; throw on simulation error. Default true. */
  simulate?: boolean
  /** Called with status updates during the transaction lifecycle. */
  onStatus?: (status: 'signing' | 'sending' | 'confirming') => void
}

/**
 * Sets recent blockhash and fee payer on the transaction, signs with the wallet,
 * optionally simulates, sends, and confirms. Call this after building a transaction
 * (builders no longer set blockhash/feePayer).
 */
export async function sendAndConfirmTransaction(
  connection: Connection,
  transaction: Transaction,
  wallet: Wallet,
  feePayer: PublicKey,
  options: SendAndConfirmOptions = {}
): Promise<string> {
  const { simulate = true, onStatus } = options
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = feePayer
  if (lastValidBlockHeight != null) {
    ;(transaction as Transaction & { lastValidBlockHeight?: number }).lastValidBlockHeight =
      lastValidBlockHeight
  }

  onStatus?.('signing')
  const signed = await wallet.signTransaction(transaction)
  if (simulate) {
    const sim = await connection.simulateTransaction(signed)
    if (sim.value.err) {
      const logs = sim.value.logs?.join('\n') ?? ''
      const msg = logs
        ? `Simulation failed:\n${logs}`
        : `Simulation failed: ${JSON.stringify(sim.value.err)}`
      throw new Error(msg)
    }
  }
  try {
    onStatus?.('sending')
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
    onStatus?.('confirming')
    await connection.confirmTransaction(sig)
    return sig
  } catch (sendErr: unknown) {
    if (sendErr instanceof Error) {
      const errObj = sendErr as Error & { logs?: string[]; data?: { logs?: string[] } }
      const logs = errObj.logs ?? errObj.data?.logs
      if (Array.isArray(logs) && logs.length) {
        errObj.message = `${errObj.message}\n${logs.join('\n')}`
      }
      throw errObj
    }
    throw sendErr
  }
}
