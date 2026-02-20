import { SystemProgram, PublicKey, type Connection } from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createSyncNativeInstruction,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import BN from 'bn.js'
import { toBN } from './utils.js'
import type { Transaction } from '@solana/web3.js'

export function isWrappedSol(mint: PublicKey | string): boolean {
  const mintPubkey = mint instanceof PublicKey ? mint : new PublicKey(mint)
  return mintPubkey.equals(NATIVE_MINT)
}

export function getWrappedSolAccount(taker: PublicKey | string): PublicKey {
  const takerPubkey = taker instanceof PublicKey ? taker : new PublicKey(taker)
  return getAssociatedTokenAddressSync(
    NATIVE_MINT,
    takerPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
}

export async function getRequestAmountLamports(params: {
  requestAmount?: BN | string | number | null
  fetchEscrowAccount?: () => Promise<{ price: number }>
  amountBN: BN
}): Promise<BN> {
  if (params.requestAmount) return toBN(params.requestAmount)
  if (params.fetchEscrowAccount) {
    const escrow = await params.fetchEscrowAccount()
    const priceScaled = new BN(Math.floor(escrow.price * 1e9))
    return params.amountBN.mul(priceScaled).div(new BN(1e9))
  }
  throw new Error('Cannot calculate request amount: need requestAmount or fetchEscrowAccount')
}

const RENT_EXEMPT_LAMPORTS = new BN(2_039_280)

export async function calculateSolToTransfer(params: {
  wrappedSolAccount: PublicKey
  requestAmountLamports: BN
  accountExists: boolean
  connection: Connection
}): Promise<BN> {
  const { requestAmountLamports, accountExists, connection, wrappedSolAccount } = params
  if (!accountExists) return requestAmountLamports.add(RENT_EXEMPT_LAMPORTS)
  try {
    const tokenAccount = await connection.getParsedAccountInfo(wrappedSolAccount)
    const data = tokenAccount.value?.data
    const uiAmount =
      (data && typeof data === 'object' && 'parsed' in data
        ? (data as { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } }).parsed?.info
            ?.tokenAmount?.uiAmount
        : undefined) ?? 0
    const currentLamports = new BN(Math.floor(uiAmount * 1e9))
    if (currentLamports.gte(requestAmountLamports)) return new BN(0)
    return requestAmountLamports.sub(currentLamports)
  } catch {
    return requestAmountLamports.add(RENT_EXEMPT_LAMPORTS)
  }
}

export function addWrappedSolInstructions(params: {
  transaction: Transaction
  takerPubkey: PublicKey
  wrappedSolAccount: PublicKey
  solToTransfer: BN
  accountExists: boolean
}): void {
  const { transaction, takerPubkey, wrappedSolAccount, solToTransfer, accountExists } = params
  if (solToTransfer.gt(new BN(0))) {
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: takerPubkey,
        toPubkey: wrappedSolAccount,
        lamports: solToTransfer.toNumber(),
      })
    )
  }
  if (!accountExists || solToTransfer.gt(new BN(0))) {
    transaction.add(createSyncNativeInstruction(wrappedSolAccount, TOKEN_PROGRAM_ID))
  }
}
