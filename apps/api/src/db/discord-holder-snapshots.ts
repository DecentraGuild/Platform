import { query } from './client.js'

export type HolderSnapshot = string[] | Array<{ wallet: string; amount: string }>

export async function getHolderSnapshot(assetId: string): Promise<HolderSnapshot | null> {
  const { rows } = await query<{ holder_wallets: HolderSnapshot }>(
    'SELECT holder_wallets FROM discord_holder_snapshots WHERE asset_id = $1',
    [assetId]
  )
  if (rows.length === 0) return null
  const raw = rows[0].holder_wallets
  return Array.isArray(raw) ? raw : []
}

export function isBalanceSnapshot(snapshot: HolderSnapshot): snapshot is Array<{ wallet: string; amount: string }> {
  return snapshot.length > 0 && typeof snapshot[0] === 'object' && snapshot[0] !== null && 'amount' in snapshot[0]
}

export function getHolderWalletsFromSnapshot(snapshot: HolderSnapshot): string[] {
  if (isBalanceSnapshot(snapshot)) return snapshot.map((x) => x.wallet)
  return snapshot as string[]
}

export function getHolderBalancesFromSnapshot(snapshot: HolderSnapshot): Map<string, number> {
  const m = new Map<string, number>()
  if (isBalanceSnapshot(snapshot)) {
    for (const { wallet, amount } of snapshot) {
      const n = Number(amount)
      if (!Number.isNaN(n)) m.set(wallet, (m.get(wallet) ?? 0) + n)
    }
  }
  return m
}

export async function upsertHolderSnapshot(
  assetId: string,
  holderWallets: string[] | Array<{ wallet: string; amount: string }>
): Promise<void> {
  await query(
    `INSERT INTO discord_holder_snapshots (asset_id, holder_wallets, last_updated)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (asset_id) DO UPDATE SET
       holder_wallets = EXCLUDED.holder_wallets,
       last_updated = NOW()`,
    [assetId, JSON.stringify(holderWallets)]
  )
}

export async function getLastUpdatedByAssetIds(assetIds: string[]): Promise<Record<string, string>> {
  if (assetIds.length === 0) return {}
  const { rows } = await query<{ asset_id: string; last_updated: string }>(
    `SELECT asset_id, last_updated::text FROM discord_holder_snapshots WHERE asset_id = ANY($1::text[])`,
    [assetIds]
  )
  const out: Record<string, string> = {}
  for (const r of rows) out[r.asset_id] = r.last_updated
  return out
}
