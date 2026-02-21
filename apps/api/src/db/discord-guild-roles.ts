import { query } from './client.js'

export interface DiscordGuildRoleRow {
  discord_guild_id: string
  role_id: string
  name: string
  position: number
}

export async function getRolesByGuildId(discordGuildId: string): Promise<DiscordGuildRoleRow[]> {
  const { rows } = await query<DiscordGuildRoleRow>(
    'SELECT * FROM discord_guild_roles WHERE discord_guild_id = $1 ORDER BY position DESC, name',
    [discordGuildId]
  )
  return rows
}

export async function upsertGuildRoles(
  discordGuildId: string,
  roles: Array<{ id: string; name: string; position?: number }>
): Promise<void> {
  if (roles.length === 0) {
    await query('DELETE FROM discord_guild_roles WHERE discord_guild_id = $1', [discordGuildId])
    return
  }
  await query('DELETE FROM discord_guild_roles WHERE discord_guild_id = $1', [discordGuildId])
  for (const r of roles) {
    await query(
      'INSERT INTO discord_guild_roles (discord_guild_id, role_id, name, position) VALUES ($1, $2, $3, $4)',
      [discordGuildId, r.id, r.name ?? r.id, r.position ?? 0]
    )
  }
}
