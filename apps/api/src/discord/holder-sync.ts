/**
 * Holder sync: fetch SPL and NFT holders for configured assets, store snapshots, optionally ingest mint metadata.
 * Sync interval scales by holder count to reduce RPC load for large collections:
 * - <1k: 15 min
 * - 1k-10k: 1 hr
 * - 10k-100k: 3 hr
 * - 100k+: 6 hr
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { fetchAssetsByGroup, fetchMintMetadataFromChain } from '@decentraguild/web3'
import { getSolanaConnection } from '../solana-connection.js'
import { getPool } from '../db/client.js'
import { getDiscordServerByGuildId, getAllLinkedGuildIds } from '../db/discord-servers.js'
import { getConfiguredAssetsByGuildId } from '../db/discord-rules.js'
import {
  getHolderSnapshotInfo,
  upsertHolderSnapshot,
} from '../db/discord-holder-snapshots.js'
import { upsertMintMetadata } from '../db/marketplace-metadata.js'

/** Minutes between syncs by holder count tier. Assets not yet synced are always due. */
const HOLDER_SYNC_INTERVAL_MINUTES: Record<string, number> = {
  '<1k': 15,
  '1k-10k': 60,
  '10k-100k': 180,
  '100k+': 360,
}

function getSyncIntervalMinutes(holderCount: number): number {
  if (holderCount < 1_000) return HOLDER_SYNC_INTERVAL_MINUTES['<1k']
  if (holderCount < 10_000) return HOLDER_SYNC_INTERVAL_MINUTES['1k-10k']
  if (holderCount < 100_000) return HOLDER_SYNC_INTERVAL_MINUTES['10k-100k']
  return HOLDER_SYNC_INTERVAL_MINUTES['100k+']
}

function isAssetDueForSync(
  assetId: string,
  snapshotInfoByAsset: Map<string, { lastUpdated: string; holderCount: number }>,
  nowMs: number
): boolean {
  const info = snapshotInfoByAsset.get(assetId)
  if (!info) return true // No snapshot yet, always sync
  const intervalMs = getSyncIntervalMinutes(info.holderCount) * 60 * 1000
  const lastMs = new Date(info.lastUpdated).getTime()
  return nowMs - lastMs >= intervalMs
}

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

export async function fetchNftCollectionHolders(
  collectionMint: string
): Promise<Array<{ wallet: string; amount: string }>> {
  const countByWallet = new Map<string, number>()
  let page = 1
  const limit = 1000
  let hasMore = true
  while (hasMore) {
    const result = await fetchAssetsByGroup('collection', collectionMint, page, limit)
    const items = (result?.items ?? []) as DasAssetWithOwner[]
    for (const item of items) {
      const owner = item.ownership?.owner
      if (owner) {
        countByWallet.set(owner, (countByWallet.get(owner) ?? 0) + 1)
      }
    }
    hasMore = items.length === limit
    page++
  }
  return [...countByWallet.entries()].map(([wallet, amount]) => ({
    wallet,
    amount: String(amount),
  }))
}

export async function syncHoldersForAsset(
  assetId: string,
  type: 'SPL' | 'NFT',
  connection: Connection,
  _log?: SyncLog
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

  const assetIds = assets.map((a) => a.asset_id)
  const snapshotInfoList = await getHolderSnapshotInfo(assetIds)
  const snapshotInfoByAsset = new Map(
    snapshotInfoList.map((s) => [s.assetId, { lastUpdated: s.lastUpdated, holderCount: s.holderCount }])
  )
  const nowMs = Date.now()
  const assetsToSync = assets.filter((a) => isAssetDueForSync(a.asset_id, snapshotInfoByAsset, nowMs))

  if (assetsToSync.length === 0) return []
  if (assetsToSync.length < assets.length) {
    log?.info?.(
      { guildId: discordGuildId, skipped: assets.length - assetsToSync.length, syncing: assetsToSync.length },
      'Holder sync: some assets skipped (not yet due per scaled interval)'
    )
  }

  const connection = getSolanaConnection()
  const results = await Promise.all(
    assetsToSync.map(async ({ asset_id, type }) => {
      try {
        const holders = await syncHoldersForAsset(asset_id, type, connection, log)
        await upsertHolderSnapshot(asset_id, holders)
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
        return { assetId: asset_id, holderCount: holders.length }
      } catch (err) {
        log?.warn?.({ err, asset_id, type }, 'Holder sync failed for asset')
        return { assetId: asset_id, holderCount: 0 }
      }
    })
  )
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
