/**
 * Send a transaction via Helius RPC.
 *
 * Usage:
 *   pnpm --filter web3 send-tx
 *
 * Env vars:
 *   HELIUS_RPC_URL   - Full RPC URL (e.g. https://mainnet.helius-rpc.com/?api-key=YOUR_KEY)
 *   HELIUS_API_KEY   - Alternative: script builds URL for mainnet if only key is set
 *   KEYPAIR_PATH     - Path to keypair JSON file (default: ~/.config/solana/id.json)
 *   RECIPIENT        - Destination wallet for SOL transfer
 *   AMOUNT_LAMPORTS  - Amount in lamports (1 SOL = 1e9)
 *   NETWORK          - mainnet-beta or devnet (default: devnet when using HELIUS_API_KEY)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function getRpcUrl(): string {
  const url = process.env.HELIUS_RPC_URL
  if (url) return url

  const apiKey = process.env.HELIUS_API_KEY
  if (!apiKey) {
    throw new Error(
      'Set HELIUS_RPC_URL or HELIUS_API_KEY. Example: HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY'
    )
  }

  const network = process.env.NETWORK ?? 'devnet'
  const host =
    network === 'mainnet-beta'
      ? 'mainnet.helius-rpc.com'
      : 'devnet.helius-rpc.com'
  return `https://${host}/?api-key=${apiKey}`
}

function getKeypair(): Keypair {
  const path =
    process.env.KEYPAIR_PATH ??
    resolve(process.env.HOME ?? process.env.USERPROFILE ?? '', '.config/solana/id.json')
  const secret = JSON.parse(readFileSync(path, 'utf-8')) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

async function main() {
  const rpcUrl = getRpcUrl()
  const connection = new Connection(rpcUrl)
  const payer = getKeypair()

  const recipientStr = process.env.RECIPIENT
  const amountStr = process.env.AMOUNT_LAMPORTS

  if (!recipientStr || !amountStr) {
    console.error('Usage: Set RECIPIENT and AMOUNT_LAMPORTS env vars.')
    console.error('Example: RECIPIENT=... AMOUNT_LAMPORTS=1000000 pnpm --filter web3 send-tx')
    process.exit(1)
  }

  const recipient = new PublicKey(recipientStr)
  const amount = Number.parseInt(amountStr, 10)
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error('AMOUNT_LAMPORTS must be a positive integer')
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports: amount,
    })
  )

  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
    maxRetries: 3,
  })

  console.log('Transaction sent:', signature)
  console.log('Explorer:', `https://explorer.solana.com/tx/${signature}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
