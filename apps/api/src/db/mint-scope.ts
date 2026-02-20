import { query, getPool } from './client.js'

export type MintScopeSource = 'collection' | 'currency' | 'spl_asset'

export interface MintScopeRow {
  tenant_slug: string
  mint: string
  source: MintScopeSource
  collection_mint: string | null
}

export interface ScopePaginatedOpts {
  page?: number
  limit?: number
  collection?: string | null
  search?: string | null
}

export async function getScopeRowsForTenant(tenantSlug: string): Promise<MintScopeRow[]> {
  const p = getPool()
  if (!p) return []

  const { rows } = await query<MintScopeRow>(
    'SELECT tenant_slug, mint, source, collection_mint FROM marketplace_mint_scope WHERE tenant_slug = $1',
    [tenantSlug]
  )
  return rows
}

export async function getScopeEntriesPaginated(
  tenantSlug: string,
  opts: ScopePaginatedOpts
): Promise<{ entries: MintScopeRow[]; total: number }> {
  const p = getPool()
  if (!p) return { entries: [], total: 0 }

  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 24))
  const offset = (page - 1) * limit

  const conditions: string[] = ['tenant_slug = $1']
  const params: unknown[] = [tenantSlug]
  let paramIdx = 2

  if (opts.collection?.trim()) {
    conditions.push(`collection_mint = $${paramIdx}`)
    params.push(opts.collection.trim())
    paramIdx++
  } else {
    conditions.push(
      "(source IN ('currency','spl_asset') OR (source = 'collection' AND mint = COALESCE(collection_mint, '')))"
    )
  }

  if (opts.search?.trim()) {
    conditions.push(`mint ILIKE $${paramIdx}`)
    params.push('%' + opts.search.trim() + '%')
    paramIdx++
  }

  const whereClause = conditions.join(' AND ')
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM marketplace_mint_scope WHERE ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10)
  if (total === 0) return { entries: [], total }

  const { rows } = await query<MintScopeRow>(
    `SELECT tenant_slug, mint, source, collection_mint FROM marketplace_mint_scope WHERE ${whereClause} ORDER BY mint LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  )

  return { entries: rows, total }
}

export async function upsertMintScope(
  tenantSlug: string,
  mint: string,
  source: MintScopeSource,
  collectionMint?: string | null
): Promise<void> {
  await query(
    `INSERT INTO marketplace_mint_scope (tenant_slug, mint, source, collection_mint)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_slug, mint) DO UPDATE SET
       source = EXCLUDED.source,
       collection_mint = EXCLUDED.collection_mint`,
    [tenantSlug, mint, source, collectionMint ?? null]
  )
}

export async function replaceScopeForTenant(
  tenantSlug: string,
  entries: Array<{ mint: string; source: MintScopeSource; collectionMint?: string | null }>
): Promise<void> {
  const client = getPool()
  if (!client) throw new Error('Database not initialized')

  const dbClient = await client.connect()
  try {
    await dbClient.query('BEGIN')
    await dbClient.query('DELETE FROM marketplace_mint_scope WHERE tenant_slug = $1', [tenantSlug])
    for (const e of entries) {
      await dbClient.query(
        `INSERT INTO marketplace_mint_scope (tenant_slug, mint, source, collection_mint)
         VALUES ($1, $2, $3, $4)`,
        [tenantSlug, e.mint, e.source, e.collectionMint ?? null]
      )
    }
    await dbClient.query('COMMIT')
  } catch (err) {
    await dbClient.query('ROLLBACK')
    throw err
  } finally {
    dbClient.release()
  }
}
