import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import type { Connection } from '@solana/web3.js'

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
const MPL_CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d')

export async function getTokenProgramIdForMint(
  connection: Connection,
  mint: PublicKey | string,
  role = 'deposit'
): Promise<typeof TOKEN_PROGRAM_ID> {
  const mintPubkey = mint instanceof PublicKey ? mint : new PublicKey(mint)
  const accountInfo = await connection.getAccountInfo(mintPubkey)
  if (!accountInfo) throw new Error(`Mint account not found: ${mintPubkey.toBase58()}`)
  const owner = accountInfo.owner
  if (owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID
  if (owner.equals(TOKEN_2022_PROGRAM_ID))
    throw new Error(`This ${role} token uses Token-2022. Our escrow supports only legacy SPL Token.`)
  if (owner.equals(MPL_CORE_PROGRAM_ID))
    throw new Error(`This ${role} NFT uses MPL Core. Our escrow supports only legacy SPL Token.`)
  throw new Error(`This ${role} token is not legacy SPL (owner: ${owner.toBase58()}).`)
}
