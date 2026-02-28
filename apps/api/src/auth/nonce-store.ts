import { getPool, query } from '../db/client.js'

const TTL_MS = 5 * 60 * 1000 // 5 minutes

interface NonceEntry {
  nonce: string
  expiresAt: number
}

const memoryStore = new Map<string, NonceEntry>()

function memoryPrune(): void {
  const now = Date.now()
  for (const [wallet, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) memoryStore.delete(wallet)
  }
}

/** Set nonce for wallet. Uses DB when available so auth works across API instances. */
export async function setNonce(wallet: string, nonce: string): Promise<void> {
  const pool = getPool()
  if (pool) {
    const expiresAt = new Date(Date.now() + TTL_MS)
    await query(
      `INSERT INTO auth_nonce (wallet, nonce, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (wallet) DO UPDATE SET nonce = $2, expires_at = $3`,
      [wallet, nonce, expiresAt]
    )
    await query('DELETE FROM auth_nonce WHERE expires_at < NOW()')
    return
  }
  memoryPrune()
  memoryStore.set(wallet, { nonce, expiresAt: Date.now() + TTL_MS })
}

/** Consume nonce if it matches and is not expired. Returns true if consumed. */
export async function consumeNonce(wallet: string, message: string): Promise<boolean> {
  const pool = getPool()
  if (pool) {
    const { rows } = await query<{ nonce: string; expires_at: Date }>(
      'DELETE FROM auth_nonce WHERE wallet = $1 RETURNING nonce, expires_at',
      [wallet]
    )
    if (rows.length === 0) return false
    const row = rows[0]
    if (row.expires_at.getTime() <= Date.now()) return false
    return row.nonce === message
  }
  const entry = memoryStore.get(wallet)
  if (!entry) return false
  memoryStore.delete(wallet)
  if (entry.expiresAt <= Date.now()) return false
  return entry.nonce === message
}
