import pg from 'pg'
import type { Pool } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool | null {
  return pool
}

export function initPool(databaseUrl: string): Pool {
  pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
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
