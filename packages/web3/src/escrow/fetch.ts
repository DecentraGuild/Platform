import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { getEscrowProgramReadOnly } from './provider.js'
import { toPublicKey } from './utils.js'
import { RPC_ESCROW_FETCH_TIMEOUT_MS } from './constants.js'
import type { Connection } from '@solana/web3.js'

export interface EscrowAccount {
  maker: PublicKey
  depositToken: PublicKey
  requestToken: PublicKey
  tokensDepositInit: BN
  tokensDepositRemaining: BN
  price: number
  decimals: number
  slippage: number
  seed: BN
  authBump: number
  vaultBump: number
  escrowBump: number
  expireTimestamp: BN
  recipient: PublicKey
  onlyRecipient: boolean
  onlyWhitelist: boolean
  allowPartialFill: boolean
  whitelist: PublicKey
}

export type EscrowWithAddress = { publicKey: PublicKey; account: EscrowAccount }

export async function fetchEscrowByAddress(
  connection: Connection,
  escrowAddress: string | PublicKey
): Promise<EscrowWithAddress | null> {
  try {
    const program = getEscrowProgramReadOnly(connection)
    const escrowPubkey = toPublicKey(escrowAddress)
    const account = await (program.account as unknown as { escrow: { fetch: (a: PublicKey) => Promise<EscrowAccount> } }).escrow.fetch(escrowPubkey)
    return { publicKey: escrowPubkey, account }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('Account does not exist')) return null
    throw err
  }
}

export async function fetchAllEscrows(
  connection: Connection,
  makerFilter?: PublicKey | string | null
): Promise<EscrowWithAddress[]> {
  const timeoutMs = RPC_ESCROW_FETCH_TIMEOUT_MS
  const fetchPromise = (async () => {
    const program = getEscrowProgramReadOnly(connection)
    const escrows = await (program.account as unknown as { escrow: { all: () => Promise<EscrowWithAddress[]> } }).escrow.all()
    if (makerFilter) {
      const makerPubkey = makerFilter instanceof PublicKey ? makerFilter : new PublicKey(makerFilter)
      return escrows.filter((e) => e.account.maker.toString() === makerPubkey.toString())
    }
    return escrows
  })()
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds.`)),
      timeoutMs
    )
  })
  return Promise.race([fetchPromise, timeoutPromise])
}
