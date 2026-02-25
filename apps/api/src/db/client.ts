import pg from 'pg'
import type { Pool } from 'pg'
import { DEFAULT_DB_POOL_MAX, DEFAULT_DB_IDLE_TIMEOUT_MS } from '../config/constants.js'

let pool: Pool | null = null

export function getPool(): Pool | null {
  return pool
}

export function initPool(databaseUrl: string): Pool {
  const max = Number(process.env.DB_POOL_MAX) || DEFAULT_DB_POOL_MAX
  const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS) || DEFAULT_DB_IDLE_TIMEOUT_MS
  pool = new pg.Pool({
    connectionString: databaseUrl,
    max,
    idleTimeoutMillis,
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
