/**
 * Scope storage abstraction: DB in prod, JSON in dev.
 * Same API: getScopeForTenant / saveScopeForTenant.
 */

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getPool } from '../db/client.js'
import {
  getScopeRowsForTenant,
  getScopeEntriesPaginated as getScopeEntriesPaginatedDb,
  replaceScopeForTenant,
  type MintScopeSource,
} from '../db/mint-scope.js'
import type { ScopePaginatedOpts } from '../db/mint-scope.js'
import { isValidTenantSlug } from '../validate-slug.js'

export interface ScopeEntry {
  mint: string
  source: MintScopeSource
  collectionMint?: string | null
}

function getScopeFilePath(slug: string): string | null {
  if (!isValidTenantSlug(slug)) return null
  const envPath = process.env.MARKETPLACE_CONFIG_PATH
  const cwd = process.cwd()
  const baseDir = envPath ? path.resolve(envPath) : path.join(cwd, '..', '..', 'configs', 'marketplace')
  const filePath = path.join(baseDir, `${slug}-scope.json`)
  return existsSync(path.dirname(filePath)) ? filePath : null
}

export async function getScopeForTenant(slug: string): Promise<string[]> {
  const entries = await getScopeEntriesForTenant(slug)
  return entries.map((e) => e.mint)
}

export async function getScopeEntriesForTenant(slug: string): Promise<ScopeEntry[]> {
  if (!isValidTenantSlug(slug)) return []
  const pool = getPool()
  if (pool) {
    const rows = await getScopeRowsForTenant(slug)
    return rows.map((r) => ({
      mint: r.mint,
      source: r.source,
      collectionMint: r.collection_mint ?? undefined,
    }))
  }

  const filePath = getScopeFilePath(slug)
  if (!filePath || !existsSync(filePath)) return []

  try {
    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw) as { entries?: ScopeEntry[]; mints?: string[] }
    if (Array.isArray(data.entries)) return data.entries
    if (Array.isArray(data.mints)) {
      return data.mints.map((m) => ({ mint: m, source: 'spl_asset' as MintScopeSource }))
    }
    return []
  } catch {
    return []
  }
}

function filterEntries(
  entries: ScopeEntry[],
  opts: { collection?: string | null; search?: string | null }
): ScopeEntry[] {
  let result = entries
  if (opts.collection?.trim()) {
    result = result.filter((e) => e.collectionMint === opts.collection!.trim())
  } else {
    result = result.filter(
      (e) =>
        e.source === 'currency' ||
        e.source === 'spl_asset' ||
        (e.source === 'collection' && e.mint === (e.collectionMint ?? ''))
    )
  }
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase()
    result = result.filter((e) => e.mint.toLowerCase().includes(q))
  }
  return result
}

export async function getScopeEntriesPaginated(
  slug: string,
  opts: ScopePaginatedOpts
): Promise<{ entries: ScopeEntry[]; total: number }> {
  if (!isValidTenantSlug(slug)) return { entries: [], total: 0 }
  const pool = getPool()
  if (pool) {
    const { entries, total } = await getScopeEntriesPaginatedDb(slug, opts)
    return {
      entries: entries.map((r) => ({
        mint: r.mint,
        source: r.source,
        collectionMint: r.collection_mint ?? undefined,
      })),
      total,
    }
  }

  const allEntries = await getScopeEntriesForTenant(slug)
  const filtered = filterEntries(allEntries, opts)
  const total = filtered.length
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 24))
  const start = (page - 1) * limit
  const entries = filtered.slice(start, start + limit)
  return { entries, total }
}

export async function saveScopeForTenant(slug: string, entries: ScopeEntry[]): Promise<void> {
  if (!isValidTenantSlug(slug)) throw new Error('Invalid tenant slug')
  const pool = getPool()
  if (pool) {
    await replaceScopeForTenant(slug, entries)
    return
  }

  const filePath = getScopeFilePath(slug)
  if (!filePath) {
    throw new Error('MARKETPLACE_CONFIG_PATH not set and DB not configured')
  }

  const payload = JSON.stringify(
    {
      mints: entries.map((e) => e.mint),
      entries: entries.map((e) => ({
        mint: e.mint,
        source: e.source,
        collectionMint: e.collectionMint ?? null,
      })),
    },
    null,
    2
  )
  await writeFile(filePath, payload, 'utf-8')
}
