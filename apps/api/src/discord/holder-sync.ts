/**
 * Holder sync: fetch SPL and NFT holders for configured assets, store snapshots, optionally ingest mint metadata.
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { getDasRpcUrl } from '@decentraguild/web3'
import { fetchAssetsByGroup } from '@decentraguild/web3'
import { getPool } from '../db/client.js'
import { getDiscordServerByGuildId, getAllLinkedGuildIds } from '../db/discord-servers.js'
import { getConfiguredAssetsByGuildId } from '../db/discord-rules.js'
import { upsertHolderSnapshot } from '../db/discord-holder-snapshots.js'
import { upsertMintMetadata } from '../db/marketplace-metadata.js'
import { fetchMintMetadataFromChain } from '@decentraguild/web3'

const SPL_TOKEN_ACCOUNT_DATA_SIZE = 165
const MINT_OFFSET = 0
const OWNER_OFFSET = 32
const AMOUNT_OFFSET = 64

interface SyncLog {
  warn?: (obj: unknown, msg?: string) => void
  info?: (obj: unknown, msg?: string) => void
}

function parseTokenAccountData(data: Buffer): { owner: string; amount: bigint } | null {
  if (data.length < 72) return null
  const owner = new PublicKey(data.subarray(OWNER_OFFSET, OWNER_OFFSET + 32))
  const amount = data.readBigUInt64LE(AMOUNT_OFFSET)
  return { owner: owner.toBase58(), amount }
}

export async function fetchSplHolders(
  mint: string,
  connection: Connection
): Promise<Array<{ wallet: string; amount: string }>> {
  const mintPubkey = new PublicKey(mint)
  const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    commitment: 'confirmed',
    filters: [
      { dataSize: SPL_TOKEN_ACCOUNT_DATA_SIZE },
      { memcmp: { offset: MINT_OFFSET, bytes: mintPubkey.toBase58() } },
    ],
  })
  const byWallet = new Map<string, bigint>()
  for (const { account } of accounts) {
    const parsed = parseTokenAccountData(account.data as Buffer)
    if (parsed && parsed.amount > 0n) {
      byWallet.set(parsed.owner, (byWallet.get(parsed.owner) ?? 0n) + parsed.amount)
    }
  }
  return [...byWallet.entries()].map(([wallet, amount]) => ({ wallet, amount: String(amount) }))
}

interface DasAssetWithOwner {
  id?: string
  ownership?: { owner?: string }
}

export async function fetchNftCollectionHolders(collectionMint: string): Promise<string[]> {
  const holders: string[] = []
  let page = 1
  const limit = 1000
  let hasMore = true
  while (hasMore) {
    const result = await fetchAssetsByGroup('collection', collectionMint, page, limit)
    const items = (result?.items ?? []) as DasAssetWithOwner[]
    for (const item of items) {
      const owner = item.ownership?.owner
      if (owner) holders.push(owner)
    }
    hasMore = items.length === limit
    page++
  }
  return [...new Set(holders)]
}

export async function syncHoldersForAsset(
  assetId: string,
  type: 'SPL' | 'NFT',
  connection: Connection,
  log?: SyncLog
): Promise<string[] | Array<{ wallet: string; amount: string }>> {
  if (type === 'SPL') {
    return fetchSplHolders(assetId, connection)
  }
  return fetchNftCollectionHolders(assetId)
}

export async function syncHoldersForGuild(
  discordGuildId: string,
  options: { ingestMintMetadata?: boolean; log?: SyncLog } = {}
): Promise<{ assetId: string; holderCount: number }[]> {
  const { ingestMintMetadata = true, log } = options
  const pool = getPool()
  if (!pool) return []
  const server = await getDiscordServerByGuildId(discordGuildId)
  if (!server) return []
  const assets = await getConfiguredAssetsByGuildId(discordGuildId)
  if (assets.length === 0) return []
  const connection = new Connection(getDasRpcUrl())
  const results: { assetId: string; holderCount: number }[] = []
  for (const { asset_id, type } of assets) {
    try {
      const holders = await syncHoldersForAsset(asset_id, type, connection, log)
      await upsertHolderSnapshot(asset_id, holders)
      results.push({ assetId: asset_id, holderCount: holders.length })
      if (ingestMintMetadata) {
        try {
          const meta = await fetchMintMetadataFromChain(connection, asset_id)
          await upsertMintMetadata(asset_id, {
            name: meta.name,
            symbol: meta.symbol,
            image: meta.image,
            decimals: meta.decimals,
            sellerFeeBasisPoints: meta.sellerFeeBasisPoints,
          }).catch((e) => log?.warn?.({ err: e, mint: asset_id }, 'Mint metadata upsert skipped'))
        } catch (err) {
          log?.warn?.({ err, mint: asset_id }, 'Mint metadata fetch skipped during holder sync')
        }
      }
    } catch (err) {
      log?.warn?.({ err, asset_id, type }, 'Holder sync failed for asset')
    }
  }
  return results
}

/** Sync holders for all linked Discord guilds. Call from cron or internal route. */
export async function syncAllLinkedGuilds(log?: SyncLog): Promise<void> {
  if (!getPool()) return
  const guildIds = await getAllLinkedGuildIds()
  for (const discordGuildId of guildIds) {
    try {
      await syncHoldersForGuild(discordGuildId, { ingestMintMetadata: true, log })
    } catch (err) {
      log?.warn?.({ err, discordGuildId }, 'Holder sync failed for guild')
    }
  }
}
