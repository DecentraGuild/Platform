import pg from 'pg'
import type { Pool } from 'pg'
import { DEFAULT_DB_POOL_MAX, DEFAULT_DB_IDLE_TIMEOUT_MS } from '../config/constants.js'

let pool: Pool | null = null

export function getPool(): Pool | null {
  return pool
}

/** Railway and other hosted Postgres require SSL; use rejectUnauthorized: false for self-signed certs. */
function getSslConfig(connectionString: string): pg.PoolConfig['ssl'] {
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    return false
  }
  return { rejectUnauthorized: false }
}

export function initPool(databaseUrl: string): Pool {
  const isRailway = databaseUrl.includes('railway')
  const defaultMax = isRailway ? 5 : DEFAULT_DB_POOL_MAX
  const max = Number(process.env.DB_POOL_MAX) || defaultMax
  const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS) || DEFAULT_DB_IDLE_TIMEOUT_MS
  const ssl = getSslConfig(databaseUrl)
  pool = new pg.Pool({
    connectionString: databaseUrl,
    max,
    idleTimeoutMillis,
    ssl,
  })
  pool.on('error', (err) => {
    console.error('Database pool error:', err.message)
  })
  return pool
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const p = pool
  if (!p) {
    throw new Error('Database not initialized. Set DATABASE_URL.')
  }
  const res = await p.query(sql, params)
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 }
}
