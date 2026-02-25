import { query } from './client.js'

export interface DiscordGuildRoleRow {
  discord_guild_id: string
  role_id: string
  name: string
  position: number
  color: number | null
  icon: string | null
  unicode_emoji: string | null
}

export async function getRolesByGuildId(discordGuildId: string): Promise<DiscordGuildRoleRow[]> {
  const { rows } = await query<DiscordGuildRoleRow>(
    'SELECT * FROM discord_guild_roles WHERE discord_guild_id = $1 ORDER BY position DESC, name',
    [discordGuildId]
  )
  return rows
}

export interface UpsertRoleInput {
  id: string
  name: string
  position?: number
  color?: number | null
  icon?: string | null
  unicode_emoji?: string | null
}

export async function upsertGuildRoles(
  discordGuildId: string,
  roles: UpsertRoleInput[]
): Promise<void> {
  if (roles.length === 0) {
    await query('DELETE FROM discord_guild_roles WHERE discord_guild_id = $1', [discordGuildId])
    return
  }
  await query('DELETE FROM discord_guild_roles WHERE discord_guild_id = $1', [discordGuildId])
  for (const r of roles) {
    const color = r.color != null && r.color !== 0 ? r.color : null
    const icon = typeof r.icon === 'string' && r.icon.length > 0 ? r.icon : null
    const unicodeEmoji = typeof r.unicode_emoji === 'string' && r.unicode_emoji.length > 0 ? r.unicode_emoji : null
    await query(
      `INSERT INTO discord_guild_roles (discord_guild_id, role_id, name, position, color, icon, unicode_emoji)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [discordGuildId, r.id, r.name ?? r.id, r.position ?? 0, color, icon, unicodeEmoji]
    )
  }
}
