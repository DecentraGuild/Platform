import {
  Transaction,
  SystemProgram,
  PublicKey,
  type Connection,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import BN from 'bn.js'
import {
  ESCROW_PROGRAM_ID,
  WHITELIST_PROGRAM_ID,
  CONTRACT_FEE_ACCOUNT,
} from '@decentraguild/contracts'
import { getEscrowProgram } from './provider.js'
import { deriveEscrowAccounts, deriveWhitelistEntryPda } from './accounts.js'
import { toPublicKey, toBN } from './utils.js'
import { checkAtaExists, makeAtaInstruction } from './ata.js'
import type { ShopFee } from './fees.js'
import { createMemoInstruction } from './memo.js'
import { getTokenProgramIdForMint } from './token-program.js'
import { getExchangeATAs, prepareTakerATAs } from './transaction-builders.js'
import {
  isWrappedSol,
  getWrappedSolAccount,
  getRequestAmountLamports,
  calculateSolToTransfer,
  addWrappedSolInstructions,
} from './wrapped-sol.js'
import type { Wallet } from './types.js'

export interface BuildInitializeParams {
  maker: PublicKey | string
  depositTokenMint: PublicKey | string
  requestTokenMint: PublicKey | string
  depositAmount: BN | string | number
  requestAmount: BN | string | number
  seed: BN | string | number
  expireTimestamp?: BN | number | null
  allowPartialFill: boolean
  onlyWhitelist: boolean
  slippage: number
  recipient?: string | null
  whitelistProgram?: string | null
  whitelist?: string | null
  entry?: string | null
  contractFeeAccount?: string | null
  shopFee?: ShopFee | null
  tradeValue?: number
  memo?: string | null
  connection: Connection
  wallet: Wallet
}

export async function buildInitializeTransaction(params: BuildInitializeParams): Promise<Transaction> {
  const {
    maker,
    depositTokenMint,
    requestTokenMint,
    depositAmount,
    requestAmount,
    seed,
    expireTimestamp = 0,
    allowPartialFill,
    onlyWhitelist,
    slippage,
    recipient,
    whitelistProgram,
    whitelist,
    entry,
    contractFeeAccount,
    shopFee,
    tradeValue = 0,
    memo,
    connection,
    wallet,
  } = params

  const transaction = new Transaction()
  if (memo?.trim()) transaction.add(createMemoInstruction(memo.trim()))

  const programId = toPublicKey(ESCROW_PROGRAM_ID)
  const makerPubkey = toPublicKey(maker)
  const seedBN = toBN(seed)
  const { auth, vault, escrow } = deriveEscrowAccounts(makerPubkey, seedBN, programId)

  const depositTokenPubkey = toPublicKey(depositTokenMint)
  const requestTokenPubkey = toPublicKey(requestTokenMint)

  await getTokenProgramIdForMint(connection, depositTokenPubkey, 'deposit')
  await getTokenProgramIdForMint(connection, requestTokenPubkey, 'request')

  const makerAta = getAssociatedTokenAddressSync(
    depositTokenPubkey,
    makerPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const feeAccount = toPublicKey(contractFeeAccount ?? CONTRACT_FEE_ACCOUNT)
  const program = getEscrowProgram(connection, wallet)

  const hasWhitelist = Boolean(whitelist?.trim())
  const whitelistProgramPubkey = hasWhitelist
    ? toPublicKey(whitelistProgram ?? WHITELIST_PROGRAM_ID)
    : program.programId
  const whitelistPubkey = hasWhitelist ? toPublicKey(whitelist!) : program.programId
  const entryPubkey = hasWhitelist
    ? deriveWhitelistEntryPda(makerPubkey, whitelistPubkey, whitelistProgramPubkey)
    : program.programId

  const recipientPubkey: PublicKey = recipient
    ? (() => {
        const r = toPublicKey(recipient)
        if (r.equals(SystemProgram.programId)) throw new Error('Cannot use SystemProgram as recipient.')
        return r
      })()
    : program.programId

  if (!(await checkAtaExists(depositTokenPubkey, makerPubkey, connection))) {
    transaction.add(makeAtaInstruction(depositTokenPubkey, makerPubkey, makerPubkey))
  }
  if (!(await checkAtaExists(requestTokenPubkey, makerPubkey, connection))) {
    transaction.add(makeAtaInstruction(requestTokenPubkey, makerPubkey, makerPubkey))
  }

  const depositAmountBN = toBN(depositAmount)
  const requestAmountBN = toBN(requestAmount)
  const expireTimestampBN = toBN(expireTimestamp ?? 0)

  const accounts = {
    maker: makerPubkey,
    makerAta,
    recipient: recipientPubkey,
    depositToken: depositTokenPubkey,
    requestToken: requestTokenPubkey,
    auth,
    vault,
    escrow,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    fee: feeAccount,
    whitelistProgram: whitelistProgramPubkey,
    whitelist: whitelistPubkey,
    entry: (entry ? toPublicKey(entry) : entryPubkey) as PublicKey,
  }

  const initIx = await program.methods
    .initialize(
      seedBN,
      depositAmountBN,
      requestAmountBN,
      expireTimestampBN,
      allowPartialFill,
      onlyWhitelist,
      slippage
    )
    .accounts(accounts as never)
    .instruction()

  transaction.add(initIx)
  await setTransactionBlockhashAndFeePayer(connection, transaction, makerPubkey)
  return transaction
}

async function setTransactionBlockhashAndFeePayer(
  connection: Connection,
  transaction: Transaction,
  feePayer: PublicKey
): Promise<void> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = feePayer
  if (lastValidBlockHeight != null) {
    ;(transaction as Transaction & { lastValidBlockHeight?: number }).lastValidBlockHeight =
      lastValidBlockHeight
  }
}

export interface BuildCancelParams {
  maker: PublicKey | string
  depositTokenMint: PublicKey | string
  requestTokenMint: PublicKey | string
  seed: BN | string | number
  memo?: string | null
  connection: Connection
  wallet: Wallet
}

export async function buildCancelTransaction(params: BuildCancelParams): Promise<Transaction> {
  const { maker, depositTokenMint, requestTokenMint, seed, memo, connection, wallet } = params
  const transaction = new Transaction()
  if (memo?.trim()) transaction.add(createMemoInstruction(memo.trim()))
  const programId = toPublicKey(ESCROW_PROGRAM_ID)
  const seedBN = toBN(seed)
  const makerPubkey = toPublicKey(maker)
  const { auth, vault, escrow } = deriveEscrowAccounts(makerPubkey, seedBN, programId)

  const depositTokenPubkey = toPublicKey(depositTokenMint)
  const requestTokenPubkey = toPublicKey(requestTokenMint)

  const makerAta = getAssociatedTokenAddressSync(
    depositTokenPubkey,
    makerPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const makerAtaRequest = getAssociatedTokenAddressSync(
    requestTokenPubkey,
    makerPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const program = getEscrowProgram(connection, wallet)
  const cancelIx = await program.methods
    .cancel()
    .accounts({
      maker: makerPubkey,
      makerAta,
      depositToken: depositTokenPubkey,
      makerAtaRequest,
      makerTokenRequest: requestTokenPubkey,
      auth,
      vault,
      escrow,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction()

  transaction.add(cancelIx)
  await setTransactionBlockhashAndFeePayer(connection, transaction, makerPubkey)
  return transaction
}

export interface BuildExchangeParams {
  maker: PublicKey | string
  taker: PublicKey | string
  depositTokenMint: PublicKey | string
  requestTokenMint: PublicKey | string
  amount: BN | string | number
  seed: BN | string | number
  requestAmount?: BN | string | number | null
  contractFeeAccount?: string | null
  whitelistProgram?: string | null
  whitelist?: string | null
  entry?: string | null
  memo?: string | null
  connection: Connection
  wallet: Wallet
}

export async function buildExchangeTransaction(params: BuildExchangeParams): Promise<Transaction> {
  const {
    maker,
    taker,
    depositTokenMint,
    requestTokenMint,
    amount,
    seed,
    requestAmount,
    contractFeeAccount,
    whitelistProgram,
    whitelist,
    entry,
    memo,
    connection,
    wallet,
  } = params

  const transaction = new Transaction()
  if (memo?.trim()) transaction.add(createMemoInstruction(memo.trim()))
  const programId = toPublicKey(ESCROW_PROGRAM_ID)
  const takerPubkey = toPublicKey(taker)
  const seedBN = toBN(seed)
  const makerPubkey = toPublicKey(maker)
  const { auth, vault, escrow } = deriveEscrowAccounts(makerPubkey, seedBN, programId)

  const { makerReceiveAta, takerAta, takerReceiveAta } = getExchangeATAs({
    maker: makerPubkey,
    taker,
    depositTokenMint,
    requestTokenMint,
  })

  const depositTokenPubkey = toPublicKey(depositTokenMint)
  const requestTokenPubkey = toPublicKey(requestTokenMint)
  const feeAccount = toPublicKey(contractFeeAccount ?? CONTRACT_FEE_ACCOUNT)

  /* Add create-ATA instructions only when missing (C2C order: request then deposit). */
  const { takerAtaExists } = await prepareTakerATAs({
    transaction,
    requestTokenMint: requestTokenPubkey,
    depositTokenMint: depositTokenPubkey,
    taker: takerPubkey,
    connection,
  })

  if (isWrappedSol(requestTokenMint)) {
    const wrappedSolAccount = getWrappedSolAccount(takerPubkey)
    const requestAmountLamports = await getRequestAmountLamports({
      requestAmount: requestAmount ?? undefined,
      fetchEscrowAccount: async () => {
        const program = getEscrowProgram(connection, wallet)
        return (program.account as unknown as { escrow: { fetch: (a: PublicKey) => Promise<{ price: number }> } }).escrow.fetch(escrow)
      },
      amountBN: toBN(amount),
    })
    const solToTransfer = await calculateSolToTransfer({
      wrappedSolAccount,
      requestAmountLamports,
      accountExists: takerAtaExists,
      connection,
    })
    addWrappedSolInstructions({
      transaction,
      takerPubkey,
      wrappedSolAccount,
      solToTransfer,
      accountExists: takerAtaExists,
    })
  }

  const program = getEscrowProgram(connection, wallet)
  const amountBN = toBN(amount)

  /* When no whitelist: use escrow program ID for all three optional accounts (Anchor convention for unused optionals). */
  const hasWhitelist = Boolean(whitelist?.trim())
  const whitelistProgramPubkey = hasWhitelist
    ? toPublicKey(whitelistProgram ?? WHITELIST_PROGRAM_ID)
    : program.programId
  const whitelistPubkey = hasWhitelist ? toPublicKey(whitelist!) : program.programId
  const entryPubkey = hasWhitelist
    ? deriveWhitelistEntryPda(takerPubkey, toPublicKey(whitelist!), whitelistProgramPubkey)
    : program.programId

  const accounts = {
    maker: makerPubkey,
    makerReceiveAta,
    depositToken: depositTokenPubkey,
    taker: takerPubkey,
    takerAta,
    takerReceiveAta,
    requestToken: requestTokenPubkey,
    auth,
    vault,
    escrow,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    fee: feeAccount,
    whitelistProgram: whitelistProgramPubkey,
    whitelist: whitelistPubkey,
    entry: entry ? toPublicKey(entry) : entryPubkey,
  }

  const exchangeIx = await program.methods.exchange(amountBN).accounts(accounts).instruction()
  transaction.add(exchangeIx)
  await setTransactionBlockhashAndFeePayer(connection, transaction, takerPubkey)
  return transaction
}
