import { PublicKey, type Connection } from '@solana/web3.js'
import { getWhitelistProgramReadOnly } from './provider.js'
import { deriveWhitelistEntryPda } from './accounts.js'
import { WHITELIST_PROGRAM_ID } from '@decentraguild/contracts'

function toPublicKey(v: string | PublicKey): PublicKey {
  return typeof v === 'string' ? new PublicKey(v) : v
}

export interface WhitelistAccount {
  authority: PublicKey
  name: string
  hasChilds: boolean
  accessCount: number
}

export interface WhitelistEntryAccount {
  parent: PublicKey
  whitelisted: PublicKey
}

export interface WhitelistWithAddress {
  publicKey: PublicKey
  account: WhitelistAccount
}

export interface WhitelistEntryWithAddress {
  publicKey: PublicKey
  account: WhitelistEntryAccount
}

export async function fetchWhitelist(
  connection: Connection,
  address: string | PublicKey
): Promise<WhitelistWithAddress | null> {
  const program = getWhitelistProgramReadOnly(connection)
  const pubkey = toPublicKey(address)
  const accounts = program.account as Record<string, { fetch: (addr: PublicKey) => Promise<unknown> }>
  try {
    const account = (await accounts.whitelist.fetch(pubkey)) as {
      authority: PublicKey
      name: string
      hasChilds: boolean
      accessCount: number
    }
    return {
      publicKey: pubkey,
      account: {
        authority: account.authority,
        name: account.name,
        hasChilds: account.hasChilds,
        accessCount: account.accessCount,
      },
    }
  } catch {
    return null
  }
}

export async function fetchAllWhitelistsByAuthority(
  connection: Connection,
  authority: string | PublicKey
): Promise<WhitelistWithAddress[]> {
  const program = getWhitelistProgramReadOnly(connection)
  const authorityPubkey = toPublicKey(authority)
  const accountNs = program.account as Record<string, { all: (filters: unknown[]) => Promise<Array<{ publicKey: PublicKey; account: unknown }>> }>
  const accounts = await accountNs.whitelist.all([
    { memcmp: { offset: 8, bytes: authorityPubkey.toBase58() } },
  ])
  return accounts.map(({ publicKey, account }) => {
    const a = account as { authority: PublicKey; name: string; hasChilds: boolean; accessCount: number }
    return {
      publicKey,
      account: { authority: a.authority, name: a.name, hasChilds: a.hasChilds, accessCount: a.accessCount },
    }
  })
}

export async function fetchWhitelistEntries(
  connection: Connection,
  whitelistAddress: string | PublicKey
): Promise<WhitelistEntryWithAddress[]> {
  const program = getWhitelistProgramReadOnly(connection)
  const whitelistPubkey = toPublicKey(whitelistAddress)
  const accountNs = program.account as Record<string, { all: (filters: unknown[]) => Promise<Array<{ publicKey: PublicKey; account: unknown }>> }>
  const accounts = await accountNs.whitelistEntry.all([
    { memcmp: { offset: 8, bytes: whitelistPubkey.toBase58() } },
  ])
  return accounts.map(({ publicKey, account }) => {
    const a = account as { parent: PublicKey; whitelisted: PublicKey }
    return { publicKey, account: { parent: a.parent, whitelisted: a.whitelisted } }
  })
}

export async function isWalletOnWhitelist(
  connection: Connection,
  wallet: string | PublicKey,
  whitelistAddress: string | PublicKey
): Promise<boolean> {
  const walletPubkey = toPublicKey(wallet)
  const whitelistPubkey = toPublicKey(whitelistAddress)
  const entryPda = deriveWhitelistEntryPda(
    walletPubkey,
    whitelistPubkey,
    WHITELIST_PROGRAM_ID
  )
  try {
    const program = getWhitelistProgramReadOnly(connection)
    const accounts = program.account as Record<string, { fetch: (addr: PublicKey) => Promise<unknown> }>
    await accounts.whitelistEntry.fetch(entryPda)
    return true
  } catch {
    return false
  }
}
