import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { getDasRpcUrl } from '@decentraguild/web3'

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const BILLING_WALLET = new PublicKey('4CJYmVAcBrgYL6iX4gUKSMeJxTm4hK3eNAzuzaYBZMCv')
/** Explicit USDC token account for the billing wallet (not a derived ATA). */
const BILLING_WALLET_ATA = new PublicKey('FoxSYPF93hPnpNoZ3eUjEAii3p6fdEESNZJe6fHbRUxr')
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

/** USDC uses 6 decimals: 1 USDC = 1_000_000 base units. */
const USDC_DECIMALS = 6

export interface VerifyResult {
  valid: boolean
  error?: string
}

/**
 * Fetch a confirmed Solana transaction and verify it contains a USDC SPL
 * transfer of the expected amount to the billing wallet ATA, plus a memo
 * matching the expected payment reference.
 */
export async function verifyBillingPayment(params: {
  txSignature: string
  expectedAmountUsdc: number
  expectedMemo: string
}): Promise<VerifyResult> {
  const { txSignature, expectedAmountUsdc, expectedMemo } = params

  let rpcUrl: string
  try {
    rpcUrl = getDasRpcUrl()
  } catch {
    return { valid: false, error: 'RPC not configured' }
  }

  const connection = new Connection(rpcUrl)
  const tx = await connection.getParsedTransaction(txSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })

  if (!tx) {
    return { valid: false, error: 'Transaction not found or not yet confirmed' }
  }

  if (tx.meta?.err) {
    return { valid: false, error: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}` }
  }

  const expectedBaseUnits = BigInt(Math.round(expectedAmountUsdc * 10 ** USDC_DECIMALS))
  const expectedAta = BILLING_WALLET_ATA.toBase58()

  let transferFound = false
  let memoFound = false

  const instructions = tx.transaction.message.instructions
  for (const ix of instructions) {
    if ('parsed' in ix && ix.programId.equals(TOKEN_PROGRAM_ID)) {
      const parsed = ix.parsed as {
        type?: string
        info?: {
          amount?: string
          destination?: string
          mint?: string
          tokenAmount?: { amount?: string }
        }
      }

      if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
        const dest = parsed.info?.destination
        const amount =
          parsed.info?.tokenAmount?.amount ?? parsed.info?.amount

        if (dest === expectedAta && amount != null) {
          if (BigInt(amount) >= expectedBaseUnits) {
            transferFound = true
          }
        }
      }
    }

    if ('parsed' in ix && ix.programId.equals(MEMO_PROGRAM_ID)) {
      const memoData = typeof ix.parsed === 'string' ? ix.parsed : ''
      if (memoData === expectedMemo) {
        memoFound = true
      }
    }

    if (!('parsed' in ix) && ix.programId.equals(MEMO_PROGRAM_ID)) {
      const raw = (ix as { data?: string }).data ?? ''
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8')
        if (decoded === expectedMemo) memoFound = true
      } catch {
        // skip
      }
    }
  }

  const innerInstructions = tx.meta?.innerInstructions ?? []
  for (const inner of innerInstructions) {
    for (const ix of inner.instructions) {
      if ('parsed' in ix && ix.programId.equals(TOKEN_PROGRAM_ID)) {
        const parsed = ix.parsed as {
          type?: string
          info?: {
            amount?: string
            destination?: string
            tokenAmount?: { amount?: string }
          }
        }
        if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
          const dest = parsed.info?.destination
          const amount = parsed.info?.tokenAmount?.amount ?? parsed.info?.amount
          if (dest === expectedAta && amount != null && BigInt(amount) >= expectedBaseUnits) {
            transferFound = true
          }
        }
      }

      if ('parsed' in ix && ix.programId.equals(MEMO_PROGRAM_ID)) {
        const memoData = typeof ix.parsed === 'string' ? ix.parsed : ''
        if (memoData === expectedMemo) memoFound = true
      }
    }
  }

  if (!transferFound) {
    return {
      valid: false,
      error: `USDC transfer of ${expectedAmountUsdc} to billing wallet not found in transaction`,
    }
  }

  if (!memoFound) {
    return {
      valid: false,
      error: 'Payment memo not found in transaction',
    }
  }

  return { valid: true }
}

export { BILLING_WALLET, BILLING_WALLET_ATA, USDC_MINT }
