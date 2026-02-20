import {
  getAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  type PublicKey as TokenPublicKey,
} from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { toPublicKey } from './utils.js'

export async function checkAtaExists(
  mint: PublicKey | string,
  owner: PublicKey | string,
  connection: Connection,
  tokenProgramId = TOKEN_PROGRAM_ID
): Promise<boolean> {
  try {
    const mintPubkey = toPublicKey(mint)
    const ownerPubkey = toPublicKey(owner)
    const ata = getAssociatedTokenAddressSync(
      mintPubkey as TokenPublicKey,
      ownerPubkey,
      false,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    await getAccount(connection, ata, 'confirmed', tokenProgramId)
    return true
  } catch {
    return false
  }
}

export function makeAtaInstruction(
  mint: PublicKey | string,
  owner: PublicKey | string,
  payer?: PublicKey | string | null,
  tokenProgramId = TOKEN_PROGRAM_ID
) {
  const mintPubkey = toPublicKey(mint)
  const ownerPubkey = toPublicKey(owner)
  const payerPubkey = payer ? toPublicKey(payer) : ownerPubkey
  const ata = getAssociatedTokenAddressSync(
    mintPubkey as TokenPublicKey,
    ownerPubkey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return createAssociatedTokenAccountInstruction(
    payerPubkey,
    ata,
    ownerPubkey,
    mintPubkey,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
}
