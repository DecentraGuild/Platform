import { query, getPool } from './client.js'

export type DiscordGuildMintKind = 'SPL' | 'NFT'

/** Stored in discord_guild_mints.trait_index for NFT entries. */
export interface DiscordGuildMintTraitIndex {
  trait_keys: string[]
  trait_options: Record<string, string[]>
}

export interface DiscordGuildMintRow {
  id: number
  discord_guild_id: string
  asset_id: string
  kind: DiscordGuildMintKind
  label: string
  trait_index: DiscordGuildMintTraitIndex | null
  created_at: string
  updated_at: string
}

export async function getDiscordMintsByGuildId(
  discordGuildId: string
): Promise<DiscordGuildMintRow[]> {
  const { rows } = await query<DiscordGuildMintRow>(
    'SELECT id, discord_guild_id, asset_id, kind, label, trait_index, created_at, updated_at FROM discord_guild_mints WHERE discord_guild_id = $1 ORDER BY id',
    [discordGuildId]
  )
  return rows
}

export interface CreateDiscordMintInput {
  discord_guild_id: string
  asset_id: string
  kind: DiscordGuildMintKind
  label: string
  trait_index?: DiscordGuildMintTraitIndex | null
}

export async function createDiscordMint(
  input: CreateDiscordMintInput
): Promise<DiscordGuildMintRow> {
  const traitIndexJson = input.trait_index != null ? JSON.stringify(input.trait_index) : null
  const { rows } = await query<DiscordGuildMintRow>(
    `INSERT INTO discord_guild_mints (discord_guild_id, asset_id, kind, label, trait_index)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (discord_guild_id, asset_id) DO UPDATE SET kind = EXCLUDED.kind, label = EXCLUDED.label, trait_index = EXCLUDED.trait_index, updated_at = NOW()
     RETURNING id, discord_guild_id, asset_id, kind, label, trait_index, created_at, updated_at`,
    [input.discord_guild_id, input.asset_id, input.kind, input.label, traitIndexJson]
  )
  if (!rows[0]) throw new Error('Failed to create discord guild mint')
  return rows[0]
}

export async function getDiscordMintById(
  id: number,
  discordGuildId: string
): Promise<DiscordGuildMintRow | null> {
  const { rows } = await query<DiscordGuildMintRow>(
    'SELECT id, discord_guild_id, asset_id, kind, label, trait_index, created_at, updated_at FROM discord_guild_mints WHERE id = $1 AND discord_guild_id = $2',
    [id, discordGuildId]
  )
  return rows[0] ?? null
}

/** True if any condition in this guild references the given asset_id (payload.mint or payload.collection_or_mint). */
export async function isAssetUsedInRules(
  discordGuildId: string,
  assetId: string
): Promise<boolean> {
  const { rows } = await query<{ n: number }>(
    `SELECT 1 AS n FROM discord_role_conditions c
     JOIN discord_role_rules r ON r.id = c.role_rule_id
     WHERE r.discord_guild_id = $1 AND c.type IN ('SPL', 'NFT', 'TRAIT')
       AND (
         (c.type = 'SPL' AND c.payload->>'mint' = $2)
         OR (c.type IN ('NFT', 'TRAIT') AND c.payload->>'collection_or_mint' = $2)
       )
     LIMIT 1`,
    [discordGuildId, assetId]
  )
  return rows.length > 0
}

export async function deleteDiscordMint(
  id: number,
  discordGuildId: string
): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM discord_guild_mints WHERE id = $1 AND discord_guild_id = $2',
    [id, discordGuildId]
  )
  return (rowCount ?? 0) > 0
}
