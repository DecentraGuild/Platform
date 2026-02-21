/**
 * Diagnostic script: test token/NFT holder fetch (RPC) and optional snapshot DB round-trip.
 * Run from repo root: pnpm --filter api exec tsx scripts/test-holder-fetch.ts <mint> [SPL|NFT]
 * Requires HELIUS_RPC or HELIUS_RPC_URL in apps/api .env. For DB round-trip, DATABASE_URL must be set.
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env') })
import { Connection } from '@solana/web3.js'
import { getDasRpcUrl } from '@decentraguild/web3'
import { fetchSplHolders, fetchNftCollectionHolders } from '../src/discord/holder-sync.js'
import { upsertHolderSnapshot, getHolderSnapshot } from '../src/db/discord-holder-snapshots.js'
import { getPool } from '../src/db/client.js'

const mint = process.argv[2]?.trim()
const type = (process.argv[3]?.toUpperCase() ?? 'SPL') as 'SPL' | 'NFT'

if (!mint || mint.length < 32) {
  console.error('Usage: pnpm --filter api exec tsx scripts/test-holder-fetch.ts <mint> [SPL|NFT]')
  process.exit(1)
}

async function main() {
  let rpcUrl: string
  try {
    rpcUrl = getDasRpcUrl()
  } catch (e) {
    console.error('RPC not configured:', (e as Error).message)
    console.error('Set HELIUS_RPC or HELIUS_RPC_URL in apps/api .env')
    process.exit(1)
  }

  console.log('RPC URL:', rpcUrl.replace(/api_key=[^&]+/, 'api_key=***'))
  console.log('Mint:', mint, '| Type:', type)
  console.log('')

  const connection = new Connection(rpcUrl, { commitment: 'confirmed' })

  let holders: string[] | Array<{ wallet: string; amount: string }>
  if (type === 'SPL') {
    console.log('Fetching SPL token holders (getProgramAccounts)...')
    holders = await fetchSplHolders(mint, connection)
    console.log('Holder count:', holders.length)
    if (holders.length > 0) {
      console.log('Sample (wallet, amount):', holders.slice(0, 5))
    }
  } else {
    console.log('Fetching NFT collection holders (DAS getAssetsByGroup)...')
    holders = await fetchNftCollectionHolders(mint)
    console.log('Holder count:', holders.length)
    if (holders.length > 0) {
      console.log('Sample wallets:', holders.slice(0, 5))
    }
  }

  const pool = getPool()
  if (pool) {
    console.log('')
    console.log('DB round-trip: upserting snapshot and re-reading...')
    await upsertHolderSnapshot(mint, holders)
    const readBack = await getHolderSnapshot(mint)
    const count = readBack ? (Array.isArray(readBack) ? readBack.length : 0) : 0
    console.log('Snapshot stored and re-read. Holder count from DB:', count)
  } else {
    console.log('')
    console.log('DATABASE_URL not set; skipping DB round-trip.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
