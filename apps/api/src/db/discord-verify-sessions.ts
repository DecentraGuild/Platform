import { randomBytes } from 'node:crypto'
import { query } from './client.js'

const TOKEN_BYTES = 32
const TTL_MINUTES = 15

export interface DiscordVerifySessionRow {
  token: string
  discord_user_id: string
  discord_guild_id: string
  expires_at: string
  created_at: string
}

export function generateVerifyToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export async function createVerifySession(
  discordUserId: string,
  discordGuildId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateVerifyToken()
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000)
  await query(
    'INSERT INTO discord_verify_sessions (token, discord_user_id, discord_guild_id, expires_at) VALUES ($1, $2, $3, $4)',
    [token, discordUserId, discordGuildId, expiresAt.toISOString()]
  )
  return { token, expiresAt }
}

export async function getAndConsumeVerifySession(token: string): Promise<{
  discordUserId: string
  discordGuildId: string
} | null> {
  const { rows } = await query<DiscordVerifySessionRow>(
    'SELECT * FROM discord_verify_sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  )
  if (rows.length === 0) return null
  const session = rows[0]
  await query('DELETE FROM discord_verify_sessions WHERE token = $1', [token])
  return {
    discordUserId: session.discord_user_id,
    discordGuildId: session.discord_guild_id,
  }
}

export async function getVerifySessionStatus(token: string): Promise<{ valid: boolean; expiresAt?: string }> {
  const { rows } = await query<{ expires_at: string }>(
    'SELECT expires_at FROM discord_verify_sessions WHERE token = $1',
    [token]
  )
  if (rows.length === 0) return { valid: false }
  const expiresAt = rows[0].expires_at
  if (new Date(expiresAt) <= new Date()) return { valid: false }
  return { valid: true, expiresAt }
}
