import { query } from './client.js'

export interface DiscordServerRow {
  tenant_slug: string
  discord_guild_id: string
  guild_name: string | null
  connected_at: string
  bot_invite_state: string | null
  bot_role_position: number | null
  created_at: string
  updated_at: string
}

export async function getDiscordServerByTenantSlug(tenantSlug: string): Promise<DiscordServerRow | null> {
  const { rows } = await query<DiscordServerRow>(
    'SELECT * FROM discord_servers WHERE tenant_slug = $1',
    [tenantSlug]
  )
  return rows[0] ?? null
}

export async function getDiscordServerByGuildId(discordGuildId: string): Promise<DiscordServerRow | null> {
  const { rows } = await query<DiscordServerRow>(
    'SELECT * FROM discord_servers WHERE discord_guild_id = $1',
    [discordGuildId]
  )
  return rows[0] ?? null
}

export async function getTenantSlugByGuildId(discordGuildId: string): Promise<string | null> {
  const row = await getDiscordServerByGuildId(discordGuildId)
  return row?.tenant_slug ?? null
}

export interface LinkDiscordServerInput {
  tenant_slug: string
  discord_guild_id: string
  guild_name?: string | null
  bot_invite_state?: string | null
}

export async function linkDiscordServer(input: LinkDiscordServerInput): Promise<DiscordServerRow> {
  const { tenant_slug, discord_guild_id, guild_name = null, bot_invite_state = null } = input
  await query(
    `INSERT INTO discord_servers (tenant_slug, discord_guild_id, guild_name, bot_invite_state, connected_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (tenant_slug) DO UPDATE SET
       discord_guild_id = EXCLUDED.discord_guild_id,
       guild_name = COALESCE(EXCLUDED.guild_name, discord_servers.guild_name),
       bot_invite_state = EXCLUDED.bot_invite_state,
       connected_at = COALESCE(discord_servers.connected_at, NOW()),
       updated_at = NOW()`,
    [tenant_slug, discord_guild_id, guild_name, bot_invite_state]
  )
  const row = await getDiscordServerByTenantSlug(tenant_slug)
  if (!row) throw new Error('Failed to read back discord_servers row')
  return row
}

export async function disconnectDiscordServer(tenantSlug: string): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM discord_servers WHERE tenant_slug = $1',
    [tenantSlug]
  )
  return (rowCount ?? 0) > 0
}

export async function updateBotRolePosition(discordGuildId: string, position: number): Promise<void> {
  await query(
    'UPDATE discord_servers SET bot_role_position = $1, updated_at = NOW() WHERE discord_guild_id = $2',
    [position, discordGuildId]
  )
}

export async function getAllLinkedGuildIds(): Promise<string[]> {
  const { rows } = await query<{ discord_guild_id: string }>(
    'SELECT discord_guild_id FROM discord_servers'
  )
  return rows.map((r) => r.discord_guild_id)
}
