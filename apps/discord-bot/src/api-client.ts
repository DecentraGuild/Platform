/**
 * Server-to-server client for DecentraGuild API. All bot routes require x-bot-secret and x-discord-guild-id.
 */

const BOT_SECRET_HEADER = 'x-bot-secret'
const GUILD_ID_HEADER = 'x-discord-guild-id'

export interface ApiConfig {
  baseUrl: string
  botSecret: string
}

export interface VerifySessionResponse {
  verify_token: string
  expires_at: string
  tenant_slug: string
}

export async function getBotContext(
  baseUrl: string,
  botSecret: string,
  discordGuildId: string
): Promise<{ tenantSlug: string; discordGuildId: string }> {
  const res = await fetch(`${baseUrl}/api/v1/discord/bot/context`, {
    method: 'GET',
    headers: {
      [BOT_SECRET_HEADER]: botSecret,
      [GUILD_ID_HEADER]: discordGuildId,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API context failed ${res.status}: ${err}`)
  }
  return res.json() as Promise<{ tenantSlug: string; discordGuildId: string }>
}

export async function createVerifySession(
  baseUrl: string,
  botSecret: string,
  discordGuildId: string,
  discordUserId: string
): Promise<VerifySessionResponse> {
  const res = await fetch(`${baseUrl}/api/v1/discord/bot/verify/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [BOT_SECRET_HEADER]: botSecret,
      [GUILD_ID_HEADER]: discordGuildId,
    },
    body: JSON.stringify({ discord_user_id: discordUserId }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API create verify session failed ${res.status}: ${err}`)
  }
  return res.json() as Promise<VerifySessionResponse>
}

export async function syncGuildRoles(
  baseUrl: string,
  botSecret: string,
  discordGuildId: string,
  roles: Array<{ id: string; name: string; position: number }>,
  botRolePosition?: number
): Promise<void> {
  const body: { roles: Array<{ id: string; name: string; position: number }>; bot_role_position?: number } = { roles }
  if (typeof botRolePosition === 'number' && botRolePosition >= 0) body.bot_role_position = botRolePosition
  const res = await fetch(`${baseUrl}/api/v1/discord/bot/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [BOT_SECRET_HEADER]: botSecret,
      [GUILD_ID_HEADER]: discordGuildId,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API sync roles failed ${res.status}: ${err}`)
  }
}

export interface EligibleRoleItem {
  discord_role_id: string
  eligible_discord_user_ids: string[]
}

export async function syncHoldersForGuild(
  baseUrl: string,
  botSecret: string,
  discordGuildId: string
): Promise<{ ok: boolean; results?: Array<{ assetId: string; holderCount: number }> }> {
  const res = await fetch(`${baseUrl}/api/v1/discord/bot/sync-holders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [BOT_SECRET_HEADER]: botSecret,
      [GUILD_ID_HEADER]: discordGuildId,
    },
    body: '{}',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API sync holders failed ${res.status}: ${err}`)
  }
  return res.json() as Promise<{ ok: boolean; results?: Array<{ assetId: string; holderCount: number }> }>
}

export async function getEligible(
  baseUrl: string,
  botSecret: string,
  discordGuildId: string,
  memberRoles?: Record<string, string[]>
): Promise<{ eligible: EligibleRoleItem[] }> {
  const headers: Record<string, string> = {
    [BOT_SECRET_HEADER]: botSecret,
    [GUILD_ID_HEADER]: discordGuildId,
  }
  const method = memberRoles != null ? 'POST' : 'GET'
  const body = memberRoles != null ? JSON.stringify({ member_roles: memberRoles }) : undefined
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${baseUrl}/api/v1/discord/bot/eligible`, {
    method,
    headers,
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API get eligible failed ${res.status}: ${err}`)
  }
  return res.json() as Promise<{ eligible: EligibleRoleItem[] }>
}

export async function scheduleRemovals(
  baseUrl: string,
  botSecret: string,
  discordGuildId: string,
  removals: Array<{ discord_user_id: string; discord_role_id: string }>
): Promise<{ ok: boolean; scheduled: number }> {
  const res = await fetch(`${baseUrl}/api/v1/discord/bot/schedule-removals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [BOT_SECRET_HEADER]: botSecret,
      [GUILD_ID_HEADER]: discordGuildId,
    },
    body: JSON.stringify({ removals }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API schedule removals failed ${res.status}: ${err}`)
  }
  return res.json() as Promise<{ ok: boolean; scheduled: number }>
}

export async function getPendingRemovals(
  baseUrl: string,
  botSecret: string,
  discordGuildId: string
): Promise<{ removals: Array<{ discord_user_id: string; discord_role_id: string }> }> {
  const res = await fetch(`${baseUrl}/api/v1/discord/bot/pending-removals`, {
    method: 'GET',
    headers: {
      [BOT_SECRET_HEADER]: botSecret,
      [GUILD_ID_HEADER]: discordGuildId,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API pending removals failed ${res.status}: ${err}`)
  }
  return res.json() as Promise<{ removals: Array<{ discord_user_id: string; discord_role_id: string }> }>
}
