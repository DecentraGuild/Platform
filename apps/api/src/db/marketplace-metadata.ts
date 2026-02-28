import { query, getPool } from './client.js'

/**
 * Mint metadata (including traits) is the single source of truth for asset display and filtering.
 * Marketplace browse/scope and Discord rule builder both read and write here; same mints are
 * not stored twice. Trait extraction from chain is centralised in marketplace/das-traits.ts.
 */

/** Strip null bytes so PostgreSQL UTF-8 text columns accept the value. */
function sanitizeText(s: string | null | undefined): string | null {
  if (s == null || typeof s !== 'string') return null
  const out = s.replace(/\0/g, '')
  return out.length ? out : null
}

export interface MintTrait {
  trait_type: string
  value: string | number
  display_type?: string
}

export interface MintMetadataRow {
  mint: string
  name: string | null
  symbol: string | null
  image: string | null
  decimals: number | null
  traits: MintTrait[] | null
  seller_fee_basis_points: number | null
  updated_at: string
}

export interface MintMetadata {
  mint: string
  name?: string | null
  symbol?: string | null
  image?: string | null
  decimals?: number | null
  traits?: MintTrait[] | null
  sellerFeeBasisPoints?: number | null
  updatedAt?: string
}

function rowToMetadata(r: MintMetadataRow & { traits?: unknown }): MintMetadata {
  const traits: MintTrait[] | null =
    r.traits && Array.isArray(r.traits) ? (r.traits as MintTrait[]) : null
  return {
    mint: r.mint,
    name: r.name,
    symbol: r.symbol,
    image: r.image,
    decimals: r.decimals,
    traits,
    sellerFeeBasisPoints: r.seller_fee_basis_points ?? undefined,
    updatedAt: r.updated_at,
  }
}

export async function getMintMetadata(mint: string): Promise<MintMetadata | null> {
  if (!getPool()) return null
  const { rows } = await query<MintMetadataRow & { traits?: unknown }>(
    'SELECT mint, name, symbol, image, decimals, traits, seller_fee_basis_points, updated_at FROM mint_metadata WHERE mint = $1',
    [mint]
  )
  if (rows.length === 0) return null
  return rowToMetadata(rows[0])
}

export async function getMintMetadataBatch(mints: string[]): Promise<Map<string, MintMetadata>> {
  const map = new Map<string, MintMetadata>()
  if (!getPool() || mints.length === 0) return map
  const unique = [...new Set(mints)]
  const { rows } = await query<MintMetadataRow & { traits?: unknown }>(
    'SELECT mint, name, symbol, image, decimals, traits, seller_fee_basis_points, updated_at FROM mint_metadata WHERE mint = ANY($1::text[])',
    [unique]
  )
  for (const r of rows) {
    map.set(r.mint, rowToMetadata(r))
  }
  return map
}

export type MintMetadataUpsert = Partial<
  Pick<MintMetadata, 'name' | 'symbol' | 'image' | 'decimals' | 'sellerFeeBasisPoints'>
>

export async function upsertMintMetadata(
  mint: string,
  data: MintMetadataUpsert & { traits?: MintTrait[] | null }
): Promise<void> {
  const name = sanitizeText(data.name ?? null)
  const symbol = sanitizeText(data.symbol ?? null)
  const image = sanitizeText(data.image ?? null)
  const traitsJson = data.traits ? JSON.stringify(data.traits).replace(/\0/g, '') : null
  await query(
    `INSERT INTO mint_metadata (mint, name, symbol, image, decimals, traits, seller_fee_basis_points, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
     ON CONFLICT (mint) DO UPDATE SET
       name = COALESCE($2, mint_metadata.name),
       symbol = COALESCE($3, mint_metadata.symbol),
       image = COALESCE($4, mint_metadata.image),
       decimals = COALESCE($5, mint_metadata.decimals),
       traits = COALESCE($6::jsonb, mint_metadata.traits),
       seller_fee_basis_points = COALESCE($7, mint_metadata.seller_fee_basis_points),
       updated_at = NOW()`,
    [
      mint,
      name,
      symbol,
      image,
      data.decimals ?? null,
      traitsJson,
      data.sellerFeeBasisPoints ?? null,
    ]
  )
}

/** Upsert mint metadata for multiple mints. Logs and skips failed upserts. */
export async function upsertMintMetadataBatch(
  mints: Array<{ mint: string } & MintMetadataUpsert>,
  onError?: (err: unknown, mint: string) => void
): Promise<void> {
  for (const { mint, ...data } of mints) {
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), data).catch((e) => {
      onError?.(e, mint.trim())
    })
  }
}
