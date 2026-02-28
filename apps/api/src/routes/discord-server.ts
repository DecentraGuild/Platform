import type { FastifyInstance } from 'fastify'
import { getPool } from '../db/client.js'
import { isValidDiscordSnowflake } from '../validate-discord.js'
import { getDiscordServerByTenantSlug, linkDiscordServer, disconnectDiscordServer } from '../db/discord-servers.js'
import { logDiscordAudit } from '../db/discord-audit.js'
import { requireTenantAdmin } from './tenant-settings.js'
import { apiError, ErrorCode } from '../api-errors.js'

// Minimal permissions: Manage Roles (268435456) + Use Application Commands (2147483648) for /verify
const DISCORD_INVITE_PERMISSIONS = '2415919104'
const DISCORD_SCOPE = 'bot%20applications.commands'

export async function registerDiscordServerRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/invite-url',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      const clientId = process.env.DISCORD_CLIENT_ID
      if (!clientId) {
        return reply.send({ invite_url: null })
      }
      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=${DISCORD_INVITE_PERMISSIONS}&scope=${DISCORD_SCOPE}`
      return reply.send({ invite_url: inviteUrl })
    }
  )

  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/server',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) {
        return reply.send({ connected: false })
      }
      const row = await getDiscordServerByTenantSlug(result.tenant.id)
      if (!row) {
        return reply.send({ connected: false })
      }
      return reply.send({
        connected: true,
        discord_guild_id: row.discord_guild_id,
        guild_name: row.guild_name,
        connected_at: row.connected_at,
      })
    }
  )

  app.post<{
    Params: { slug: string }
    Body: { discord_guild_id: string; guild_name?: string }
  }>(
    '/api/v1/tenant/:slug/discord/server',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) {
        return reply.status(503).send(apiError('Database not available', ErrorCode.SERVICE_UNAVAILABLE))
      }
      const discordGuildId = request.body?.discord_guild_id?.trim()
      if (!discordGuildId || !isValidDiscordSnowflake(discordGuildId)) {
        return reply.status(400).send(apiError('discord_guild_id required (valid Discord server ID)', ErrorCode.BAD_REQUEST))
      }
      const guildName = request.body?.guild_name?.trim() ?? null
      try {
        await linkDiscordServer({
          tenant_slug: result.tenant.id,
          discord_guild_id: discordGuildId,
          guild_name: guildName,
        })
        await logDiscordAudit(
          'server_link',
          { tenant_slug: result.tenant.id, discord_guild_id: discordGuildId },
          discordGuildId
        )
        const row = await getDiscordServerByTenantSlug(result.tenant.id)
        return reply.send({
          connected: true,
          discord_guild_id: row!.discord_guild_id,
          guild_name: row!.guild_name,
          connected_at: row!.connected_at,
        })
      } catch (err) {
        request.log.error({ err }, 'Discord server link failed')
        return reply.status(500).send(apiError('Failed to link server', ErrorCode.INTERNAL_ERROR))
      }
    }
  )

  app.delete<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/server',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) {
        return reply.status(503).send(apiError('Database not available', ErrorCode.SERVICE_UNAVAILABLE))
      }
      const row = await getDiscordServerByTenantSlug(result.tenant.id)
      const guildId = row?.discord_guild_id ?? null
      const removed = await disconnectDiscordServer(result.tenant.id)
      if (removed && guildId) {
        await logDiscordAudit('server_unlink', { tenant_slug: result.tenant.id }, guildId)
      }
      return reply.send({ connected: false, disconnected: removed })
    }
  )
}
