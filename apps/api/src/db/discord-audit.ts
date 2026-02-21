import { query } from './client.js'

export type DiscordAuditAction =
  | 'server_link'
  | 'server_unlink'
  | 'rule_create'
  | 'rule_update'
  | 'rule_delete'
  | 'role_add'
  | 'role_remove'
  | 'verify_link'
  | 'verify_revoke'

export async function logDiscordAudit(
  action: DiscordAuditAction,
  details: Record<string, unknown>,
  discordGuildId?: string | null
): Promise<void> {
  await query(
    'INSERT INTO discord_audit_log (discord_guild_id, action, details) VALUES ($1, $2, $3::jsonb)',
    [discordGuildId ?? null, action, JSON.stringify(details)]
  )
}
