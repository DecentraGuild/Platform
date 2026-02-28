import {
  Transaction,
  PublicKey,
  type Connection,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { createMemoInstruction } from '../escrow/memo.js'

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const USDC_DECIMALS = 6

export interface BuildBillingTransferParams {
  payer: PublicKey
  amountUsdc: number
  /** The recipient's USDC token account (ATA). Pass explicitly; do not derive. */
  recipientAta: PublicKey
  memo: string
  connection: Connection
}

/**
 * Build a USDC SPL transfer transaction with a memo instruction for billing.
 * Returns an unsigned transaction; caller signs via sendAndConfirmTransaction.
 */
export function buildBillingTransfer(params: BuildBillingTransferParams): Transaction {
  const { payer, amountUsdc, recipientAta, memo } = params

  const senderAta = getAssociatedTokenAddressSync(USDC_MINT, payer)

  const amount = BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS))

  const tx = new Transaction()

  tx.add(
    createTransferInstruction(
      senderAta,
      recipientAta,
      payer,
      amount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  )

  tx.add(createMemoInstruction(memo))

  return tx
}

export { USDC_MINT, USDC_DECIMALS }
