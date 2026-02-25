import type { FastifyRequest, FastifyReply } from 'fastify'
import { getTenantSlugByGuildId } from '../db/discord-servers.js'
import { secureCompare } from '../secure-compare.js'
import { apiError, ErrorCode } from '../api-errors.js'

export interface DiscordBotContext {
  tenantSlug: string
  discordGuildId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    discordContext?: DiscordBotContext
  }
}

const BOT_SECRET_HEADER = 'x-bot-secret'
const GUILD_ID_HEADER = 'x-discord-guild-id'

function getBotSecret(request: FastifyRequest): string | null {
  const header = request.headers[BOT_SECRET_HEADER]
  if (typeof header === 'string' && header.trim()) return header.trim()
  const auth = request.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

function getGuildId(request: FastifyRequest): string | null {
  const header = request.headers[GUILD_ID_HEADER]
  if (typeof header === 'string' && header.trim()) return header.trim()
  const body = request.body as Record<string, unknown> | undefined
  const id = body?.discord_guild_id ?? body?.guild_id
  if (typeof id === 'string' && id.trim()) return id.trim()
  return null
}

/**
 * PreHandler for routes called by the Discord bot. Verifies bot secret and resolves tenant from discord_guild_id.
 * Sets request.discordContext = { tenantSlug, discordGuildId }. Reply 401 if secret invalid or guild not linked.
 */
export async function requireDiscordBotAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const secret = process.env.DISCORD_BOT_API_SECRET
  if (!secret) {
    request.log.warn('DISCORD_BOT_API_SECRET not set')
    await reply.status(503).send(apiError('Bot auth not configured', ErrorCode.CONFIG_REQUIRED))
    return
  }
  const provided = getBotSecret(request)
  if (!provided || !secureCompare(provided, secret)) {
    await reply.status(401).send(apiError('Invalid bot secret', ErrorCode.UNAUTHORIZED))
    return
  }
  const discordGuildId = getGuildId(request)
  if (!discordGuildId) {
    await reply.status(400).send(apiError('discord_guild_id required (header x-discord-guild-id or body)', ErrorCode.BAD_REQUEST))
    return
  }
  const tenantSlug = await getTenantSlugByGuildId(discordGuildId)
  if (!tenantSlug) {
    await reply.status(404).send(apiError('Guild not linked to a tenant', ErrorCode.GUILD_NOT_LINKED))
    return
  }
  request.discordContext = { tenantSlug, discordGuildId }
}
