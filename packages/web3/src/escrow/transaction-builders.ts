import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { PublicKey, type Transaction } from '@solana/web3.js'
import { toPublicKey } from './utils.js'
import { checkAtaExists, makeAtaInstruction } from './ata.js'
import { TRANSACTION_COSTS } from './constants.js'

export function getExchangeATAs(params: {
  maker: PublicKey | string
  taker: PublicKey | string
  depositTokenMint: PublicKey | string
  requestTokenMint: PublicKey | string
}) {
  const makerPubkey = toPublicKey(params.maker)
  const takerPubkey = toPublicKey(params.taker)
  const depositTokenPubkey = toPublicKey(params.depositTokenMint)
  const requestTokenPubkey = toPublicKey(params.requestTokenMint)
  return {
    makerReceiveAta: getAssociatedTokenAddressSync(
      requestTokenPubkey,
      makerPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    takerAta: getAssociatedTokenAddressSync(
      requestTokenPubkey,
      takerPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    takerReceiveAta: getAssociatedTokenAddressSync(
      depositTokenPubkey,
      takerPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
  }
}

/**
 * Add create-ATA instructions only for taker ATAs that are missing (C2C behaviour).
 * Order: request-token ATA first, then deposit-token ATA. If the user already has both, no instructions added.
 */
export async function prepareTakerATAs(params: {
  transaction: Transaction
  requestTokenMint: PublicKey | string
  depositTokenMint: PublicKey | string
  taker: PublicKey | string
  connection: import('@solana/web3.js').Connection
}) {
  const { transaction, requestTokenMint, depositTokenMint, taker, connection } = params
  const requestTokenPubkey = toPublicKey(requestTokenMint)
  const depositTokenPubkey = toPublicKey(depositTokenMint)
  const takerPubkey = toPublicKey(taker)
  const takerAtaExists = await checkAtaExists(requestTokenPubkey, takerPubkey, connection)
  const takerReceiveAtaExists = await checkAtaExists(depositTokenPubkey, takerPubkey, connection)
  let totalCost = 0
  if (!takerAtaExists) {
    transaction.add(makeAtaInstruction(requestTokenPubkey, takerPubkey, takerPubkey))
    totalCost += TRANSACTION_COSTS.ATA_CREATION
  }
  if (!takerReceiveAtaExists) {
    transaction.add(makeAtaInstruction(depositTokenPubkey, takerPubkey, takerPubkey))
    totalCost += TRANSACTION_COSTS.ATA_CREATION
  }
  return { takerAtaExists, takerReceiveAtaExists, totalCost }
}
