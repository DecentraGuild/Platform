import { query, getPool } from './client.js'

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

export async function upsertMintMetadata(
  mint: string,
  data: Partial<Pick<MintMetadata, 'name' | 'symbol' | 'image' | 'decimals' | 'traits' | 'sellerFeeBasisPoints'>>
): Promise<void> {
  const traitsJson = data.traits ? JSON.stringify(data.traits) : null
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
      data.name ?? null,
      data.symbol ?? null,
      data.image ?? null,
      data.decimals ?? null,
      traitsJson,
      data.sellerFeeBasisPoints ?? null,
    ]
  )
}
