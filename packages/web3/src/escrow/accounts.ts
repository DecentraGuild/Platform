import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { toBN } from './utils.js'
import { WHITELIST_PROGRAM_ID } from '@decentraguild/contracts'

/**
 * Derive the user's whitelist entry PDA for the given whitelist account.
 * Seeds: [user_wallet.toBuffer(), whitelist_pubkey.toBuffer()]
 */
export function deriveWhitelistEntryPda(
  userPubkey: PublicKey,
  whitelistPubkey: PublicKey,
  whitelistProgramId: PublicKey | string = WHITELIST_PROGRAM_ID
): PublicKey {
  const programId =
    typeof whitelistProgramId === 'string'
      ? new PublicKey(whitelistProgramId)
      : whitelistProgramId
  const [entry] = PublicKey.findProgramAddressSync(
    [userPubkey.toBuffer(), whitelistPubkey.toBuffer()],
    programId
  )
  return entry
}

/**
 * Derive PDA accounts for escrow.
 */
export function deriveEscrowAccounts(
  maker: PublicKey,
  seed: BN,
  programId: PublicKey
): { auth: PublicKey; vault: PublicKey; escrow: PublicKey } {
  const seedBN = toBN(seed)
  const [escrow] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('escrow'),
      maker.toBuffer(),
      seedBN.toArrayLike(Buffer, 'le', 8),
    ],
    programId
  )
  const [auth] = PublicKey.findProgramAddressSync(
    [Buffer.from('auth'), escrow.toBuffer()],
    programId
  )
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), escrow.toBuffer()],
    programId
  )
  return { auth, vault, escrow }
}
