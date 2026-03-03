import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import BN from 'bn.js'
import { getRaffleProgram } from './provider.js'
import { deriveRafflePda, deriveTicketsPda, deriveTicketVaultPda, derivePrizeVaultPda } from './accounts.js'
import { deriveWhitelistEntryPda } from '../escrow/accounts.js'
import { RAFFLE_FEE_ACCOUNT, RAFFLE_PROGRAM_ID, WHITELIST_PROGRAM_ID } from '@decentraguild/contracts'
import type { Wallet } from '../escrow/types.js'

/** Anchor instruction discriminators (sha256("global:<name>")[0..8]). */
const DISCRIMINATOR_PREPARE = Buffer.from([121, 155, 156, 90, 164, 252, 220, 109])
const DISCRIMINATOR_CLOSE = Buffer.from([98, 165, 201, 177, 108, 65, 206, 96])
const DISCRIMINATOR_ENABLE = Buffer.from([159, 34, 127, 41, 193, 53, 124, 27])
const DISCRIMINATOR_DISABLE = Buffer.from([185, 173, 187, 90, 216, 15, 238, 233])
const DISCRIMINATOR_EDIT = Buffer.from([15, 183, 33, 86, 87, 28, 151, 145])
const DISCRIMINATOR_REVEAL_WINNERS = Buffer.from([24, 167, 123, 197, 91, 200, 146, 3])
const DISCRIMINATOR_CLAIM_PRIZE = Buffer.from([157, 233, 139, 121, 246, 62, 234, 235])
const DISCRIMINATOR_CLAIM_TICKETS = Buffer.from([115, 177, 141, 142, 7, 255, 105, 60])
const DISCRIMINATOR_BUY_TICKETS = Buffer.from([48, 16, 122, 137, 24, 214, 198, 58])

function toPublicKey(v: string | PublicKey): PublicKey {
  return typeof v === 'string' ? new PublicKey(v) : v
}

/** Convert 8-byte buffer (LE) to BN for u64. */
function seedToBN(seed: Uint8Array | Buffer): BN {
  const buf = Buffer.isBuffer(seed) ? Buffer.from(seed) : Buffer.from(seed)
  return new BN(buf.readBigUInt64LE(0).toString())
}

export interface BuildInitializeRaffleParams {
  name: string
  description: string
  seed: Uint8Array | Buffer
  ticketMint: PublicKey | string
  ticketPrice: bigint | string
  ticketDecimals: number
  maxTickets: number
  useWhitelist: boolean
  whitelist?: PublicKey | string | null
  whitelistProgram?: PublicKey | string | null
  connection: import('@solana/web3.js').Connection
  wallet: Wallet
}

export async function buildInitializeRaffleTransaction(
  params: BuildInitializeRaffleParams
): Promise<Transaction> {
  const {
    name,
    description,
    seed,
    ticketMint,
    ticketPrice,
    maxTickets,
    useWhitelist,
    whitelist,
    connection,
    wallet,
  } = params
  const creator = wallet.publicKey
  const ticketMintPubkey = toPublicKey(ticketMint)
  const seedBuf = Buffer.isBuffer(seed) ? Buffer.from(seed) : Buffer.from(seed)
  const seedBN = seedToBN(seedBuf)

  const rafflePda = deriveRafflePda(name, seedBuf)
  const ticketsPda = deriveTicketsPda(rafflePda)
  const ticketsAtaPda = deriveTicketVaultPda(rafflePda)

  const program = getRaffleProgram(connection, wallet)

  const ticketPriceBN = typeof ticketPrice === 'bigint' ? new BN(ticketPrice.toString()) : new BN(ticketPrice)

  const accounts: Record<string, PublicKey> = {
    creator,
    raffle: rafflePda,
    tickets: ticketsPda,
    ticketsAta: ticketsAtaPda,
    ticketsMint: ticketMintPubkey,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  }

  if (useWhitelist && whitelist) {
    accounts.whitelist = toPublicKey(whitelist)
  } else {
    accounts.whitelist = program.programId
  }

  const ix = await program.methods
    .initialize(name, description, ticketPriceBN, maxTickets, seedBN)
    .accounts(accounts)
    .instruction()

  return new Transaction().add(ix)
}

export interface BuildPrepareRaffleParams {
  rafflePubkey: PublicKey | string
  prizeMint: PublicKey | string
  amount: bigint | string
  imageUrl?: string
  connection: import('@solana/web3.js').Connection
  wallet: Wallet
}

/** Encode prepare args as Borsh: u64 amount, string imageUrl. */
function encodePrepareArgs(amount: BN, imageUrl: string): Buffer {
  const strBytes = Buffer.from(imageUrl, 'utf8')
  const buf = Buffer.alloc(8 + 4 + strBytes.length)
  let off = 0
  buf.writeBigUInt64LE(BigInt(amount.toString()), off)
  off += 8
  buf.writeUInt32LE(strBytes.length, off)
  off += 4
  strBytes.copy(buf, off)
  return buf
}

export async function buildPrepareRaffleTransaction(
  params: BuildPrepareRaffleParams
): Promise<Transaction> {
  const { rafflePubkey, prizeMint, amount, imageUrl = '', connection, wallet } = params
  const creator = wallet.publicKey
  const rafflePk = toPublicKey(rafflePubkey)
  const prizeMintPk = toPublicKey(prizeMint)

  const fromAta = getAssociatedTokenAddressSync(prizeMintPk, creator)
  const prizeVaultPda = derivePrizeVaultPda(rafflePk)

  const amountBN = typeof amount === 'bigint' ? new BN(amount.toString()) : new BN(amount)
  const argsBuf = encodePrepareArgs(amountBN, imageUrl)
  const data = Buffer.concat([DISCRIMINATOR_PREPARE, argsBuf])

  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: fromAta, isSigner: false, isWritable: true },
      { pubkey: prizeVaultPda, isSigner: false, isWritable: true },
      { pubkey: prizeMintPk, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(RAFFLE_FEE_ACCOUNT), isSigner: false, isWritable: true },
    ],
    data,
  })

  return new Transaction().add(ix)
}

/** Encode edit args as Borsh: string name, string description, string url. */
function encodeEditArgs(name: string, description: string, url: string): Buffer {
  const enc = (s: string) => {
    const b = Buffer.from(s, 'utf8')
    const h = Buffer.alloc(4)
    h.writeUInt32LE(b.length, 0)
    return Buffer.concat([h, b])
  }
  return Buffer.concat([enc(name), enc(description), enc(url)])
}

export async function buildEnableRaffleTransaction(params: {
  rafflePubkey: PublicKey | string
  wallet: Wallet
}): Promise<Transaction> {
  const { rafflePubkey, wallet } = params
  const creator = wallet.publicKey
  const rafflePk = toPublicKey(rafflePubkey)
  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISCRIMINATOR_ENABLE),
  })
  return new Transaction().add(ix)
}

export async function buildDisableRaffleTransaction(params: {
  rafflePubkey: PublicKey | string
  wallet: Wallet
}): Promise<Transaction> {
  const { rafflePubkey, wallet } = params
  const creator = wallet.publicKey
  const rafflePk = toPublicKey(rafflePubkey)
  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISCRIMINATOR_DISABLE),
  })
  return new Transaction().add(ix)
}

export async function buildEditRaffleTransaction(params: {
  rafflePubkey: PublicKey | string
  name: string
  description: string
  url: string
  wallet: Wallet
}): Promise<Transaction> {
  const { rafflePubkey, name, description, url, wallet } = params
  const creator = wallet.publicKey
  const rafflePk = toPublicKey(rafflePubkey)
  const args = encodeEditArgs(name, description, url)
  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISCRIMINATOR_EDIT, args]),
  })
  return new Transaction().add(ix)
}

export async function buildRevealWinnersTransaction(params: {
  rafflePubkey: PublicKey | string
  wallet: Wallet
}): Promise<Transaction> {
  const { rafflePubkey } = params
  const rafflePk = toPublicKey(rafflePubkey)
  const ticketsPda = deriveTicketsPda(rafflePk)
  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: ticketsPda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISCRIMINATOR_REVEAL_WINNERS),
  })
  return new Transaction().add(ix)
}

export async function buildClaimPrizeTransaction(params: {
  rafflePubkey: PublicKey | string
  prizeMint: PublicKey | string
  winnerAta: PublicKey | string
  connection: import('@solana/web3.js').Connection
  wallet: Wallet
}): Promise<Transaction> {
  const { rafflePubkey, prizeMint, winnerAta, wallet } = params
  const rafflePk = toPublicKey(rafflePubkey)
  const prizeMintPk = toPublicKey(prizeMint)
  const toAta = toPublicKey(winnerAta)
  const ticketsPda = deriveTicketsPda(rafflePk)
  const prizeVaultPda = derivePrizeVaultPda(rafflePk)
  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: ticketsPda, isSigner: false, isWritable: false },
      { pubkey: prizeVaultPda, isSigner: false, isWritable: true },
      { pubkey: prizeMintPk, isSigner: false, isWritable: false },
      { pubkey: toAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISCRIMINATOR_CLAIM_PRIZE),
  })
  return new Transaction().add(ix)
}

export async function buildClaimTicketsTransaction(params: {
  rafflePubkey: PublicKey | string
  ticketMint: PublicKey | string
  creatorAta: PublicKey | string
  wallet: Wallet
}): Promise<Transaction> {
  const { rafflePubkey, ticketMint, creatorAta, wallet } = params
  const creator = wallet.publicKey
  const rafflePk = toPublicKey(rafflePubkey)
  const ticketMintPk = toPublicKey(ticketMint)
  const ticketsVaultPda = deriveTicketVaultPda(rafflePk)
  const toAta = toPublicKey(creatorAta)
  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: creator, isSigner: true, isWritable: false },
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: ticketsVaultPda, isSigner: false, isWritable: true },
      { pubkey: ticketMintPk, isSigner: false, isWritable: false },
      { pubkey: toAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISCRIMINATOR_CLAIM_TICKETS),
  })
  return new Transaction().add(ix)
}

export interface BuildBuyTicketsParams {
  rafflePubkey: PublicKey | string
  ticketAmount: number
  chainData: { ticketMint: string; useWhitelist: boolean; whitelist: string | null }
  connection: import('@solana/web3.js').Connection
  wallet: Wallet
}

export async function buildBuyTicketsTransaction(params: BuildBuyTicketsParams): Promise<Transaction> {
  const { rafflePubkey, ticketAmount, chainData, connection, wallet } = params
  const buyer = wallet.publicKey
  const rafflePk = toPublicKey(rafflePubkey)
  const ticketMintPk = toPublicKey(chainData.ticketMint)

  const ticketsPda = deriveTicketsPda(rafflePk)
  const ticketsAtaPda = deriveTicketVaultPda(rafflePk)
  const fromAta = getAssociatedTokenAddressSync(ticketMintPk, buyer)

  const keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: buyer, isSigner: false, isWritable: false },
    { pubkey: rafflePk, isSigner: false, isWritable: true },
    { pubkey: ticketsPda, isSigner: false, isWritable: true },
    { pubkey: ticketsAtaPda, isSigner: false, isWritable: true },
    { pubkey: ticketMintPk, isSigner: false, isWritable: false },
    { pubkey: fromAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  if (chainData.useWhitelist && chainData.whitelist) {
    const whitelistPk = toPublicKey(chainData.whitelist)
    const whitelistEntryPda = deriveWhitelistEntryPda(buyer, whitelistPk, WHITELIST_PROGRAM_ID)
    keys.push({ pubkey: whitelistPk, isSigner: false, isWritable: true })
    keys.push({ pubkey: whitelistEntryPda, isSigner: false, isWritable: true })
    keys.push({ pubkey: toPublicKey(WHITELIST_PROGRAM_ID), isSigner: false, isWritable: false })
  } else {
    keys.push({ pubkey: new PublicKey(RAFFLE_PROGRAM_ID), isSigner: false, isWritable: false })
    keys.push({ pubkey: new PublicKey(RAFFLE_PROGRAM_ID), isSigner: false, isWritable: false })
    keys.push({ pubkey: new PublicKey(RAFFLE_PROGRAM_ID), isSigner: false, isWritable: false })
  }

  keys.push({ pubkey: new PublicKey(RAFFLE_FEE_ACCOUNT), isSigner: false, isWritable: true })

  const ticketAmountBuf = Buffer.alloc(4)
  ticketAmountBuf.writeUInt32LE(ticketAmount, 0)
  const data = Buffer.concat([DISCRIMINATOR_BUY_TICKETS, ticketAmountBuf])

  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys,
    data,
  })

  return new Transaction().add(ix)
}

export async function buildCloseRaffleTransaction(params: {
  rafflePubkey: PublicKey | string
  connection: import('@solana/web3.js').Connection
  wallet: Wallet
}): Promise<Transaction> {
  const { rafflePubkey, wallet } = params
  const creator = wallet.publicKey
  const rafflePk = toPublicKey(rafflePubkey)
  const ticketsPda = deriveTicketsPda(rafflePk)
  const ticketsVaultPda = deriveTicketVaultPda(rafflePk)
  const prizeVaultPda = derivePrizeVaultPda(rafflePk)

  const ix = new TransactionInstruction({
    programId: new PublicKey(RAFFLE_PROGRAM_ID),
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: rafflePk, isSigner: false, isWritable: true },
      { pubkey: ticketsPda, isSigner: false, isWritable: true },
      { pubkey: ticketsVaultPda, isSigner: false, isWritable: true },
      { pubkey: prizeVaultPda, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISCRIMINATOR_CLOSE),
  })

  return new Transaction().add(ix)
}
