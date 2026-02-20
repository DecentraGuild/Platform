import type { Connection } from '@solana/web3.js'
import { Transaction, type PublicKey } from '@solana/web3.js'
import type { Wallet } from './types.js'

export interface SendAndConfirmOptions {
  /** Run simulation before sending; throw on simulation error. Default true. */
  simulate?: boolean
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
  const { simulate = true } = options
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = feePayer
  if (lastValidBlockHeight != null) {
    ;(transaction as Transaction & { lastValidBlockHeight?: number }).lastValidBlockHeight =
      lastValidBlockHeight
  }

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
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
    await connection.confirmTransaction(sig)
    return sig
  } catch (sendErr: unknown) {
    const base = sendErr instanceof Error ? sendErr.message : String(sendErr)
    const errObj = sendErr as { logs?: string[]; data?: { logs?: string[] } }
    const logs = errObj.logs ?? errObj.data?.logs
    const withLogs = Array.isArray(logs) && logs.length
      ? `${base}\n${logs.join('\n')}`
      : base
    throw new Error(withLogs)
  }
}
