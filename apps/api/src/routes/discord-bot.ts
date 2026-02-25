import type { FastifyInstance } from 'fastify'
import { requireDiscordBotAuth } from '../discord/bot-auth.js'
import { upsertGuildRoles } from '../db/discord-guild-roles.js'
import { updateBotRolePosition } from '../db/discord-servers.js'
import { computeEligiblePerRole } from '../discord/rule-engine.js'
import { scheduleRemovalsBatch, getAndClaimDueRemovals } from '../db/discord-removal-queue.js'
import { logDiscordAudit } from '../db/discord-audit.js'
import { apiError, ErrorCode } from '../api-errors.js'

/**
 * Routes called by the Discord bot with server-to-server auth.
 * All require x-bot-secret (or Authorization Bearer) and x-discord-guild-id (or body discord_guild_id).
 * request.discordContext is set by requireDiscordBotAuth.
 */
export async function registerDiscordBotRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/discord/bot/context',
    { preHandler: [requireDiscordBotAuth] },
    async (request, _reply) => {
      const ctx = request.discordContext!
      return { tenantSlug: ctx.tenantSlug, discordGuildId: ctx.discordGuildId }
    }
  )

  app.post<{
    Body: {
      roles?: Array<{
        id: string
        name?: string
        position?: number
        color?: number | null
        icon?: string | null
        unicode_emoji?: string | null
      }>
      bot_role_position?: number
    }
  }>(
    '/api/v1/discord/bot/roles',
    { preHandler: [requireDiscordBotAuth] },
    async (request, reply) => {
      const ctx = request.discordContext!
      const roles = request.body?.roles
      if (!Array.isArray(roles)) {
        return reply.status(400).send(apiError('roles array required', ErrorCode.BAD_REQUEST))
      }
      const normalized = roles
        .filter((r) => r && typeof r.id === 'string')
        .map((r) => ({
          id: r.id,
          name: typeof r.name === 'string' ? r.name : r.id,
          position: typeof r.position === 'number' ? r.position : 0,
          color: typeof r.color === 'number' ? r.color : null,
          icon: typeof r.icon === 'string' ? r.icon : null,
          unicode_emoji: typeof r.unicode_emoji === 'string' ? r.unicode_emoji : null,
        }))
      await upsertGuildRoles(ctx.discordGuildId, normalized)
      const botPosition = request.body?.bot_role_position
      if (typeof botPosition === 'number' && botPosition >= 0) {
        await updateBotRolePosition(ctx.discordGuildId, botPosition)
      }
      return reply.send({ ok: true, count: normalized.length })
    }
  )

  app.get(
    '/api/v1/discord/bot/eligible',
    { preHandler: [requireDiscordBotAuth] },
    async (request, reply) => {
      const ctx = request.discordContext!
      const eligible = await computeEligiblePerRole(ctx.discordGuildId)
      return reply.send({ eligible })
    }
  )

  app.post<{
    Body: { member_roles?: Record<string, string[]> }
  }>(
    '/api/v1/discord/bot/eligible',
    { preHandler: [requireDiscordBotAuth] },
    async (request, reply) => {
      const ctx = request.discordContext!
      const body = request.body ?? {}
      const memberRoles = body.member_roles
      const memberRolesByUserId =
        memberRoles && typeof memberRoles === 'object'
          ? new Map<string, string[]>(
              Object.entries(memberRoles).map(([id, roles]) => [
                id,
                Array.isArray(roles) ? (roles as string[]).filter((r): r is string => typeof r === 'string') : [],
              ])
            )
          : undefined
      const eligible = await computeEligiblePerRole(ctx.discordGuildId, { memberRolesByUserId })
      return reply.send({ eligible })
    }
  )

  app.post<{
    Body: { removals?: Array<{ discord_user_id: string; discord_role_id: string }> }
  }>(
    '/api/v1/discord/bot/schedule-removals',
    { preHandler: [requireDiscordBotAuth] },
    async (request, reply) => {
      const ctx = request.discordContext!
      const removals = request.body?.removals
      if (!Array.isArray(removals)) {
        return reply.status(400).send(apiError('removals array required', ErrorCode.BAD_REQUEST))
      }
      const normalized = removals
        .filter((r) => r && typeof r.discord_user_id === 'string' && typeof r.discord_role_id === 'string')
        .map((r) => ({ discord_user_id: r.discord_user_id, discord_role_id: r.discord_role_id }))
      const count = await scheduleRemovalsBatch(ctx.discordGuildId, normalized)
      return reply.send({ ok: true, scheduled: count })
    }
  )

  app.get(
    '/api/v1/discord/bot/pending-removals',
    { preHandler: [requireDiscordBotAuth] },
    async (request, reply) => {
      const ctx = request.discordContext!
      const rows = await getAndClaimDueRemovals(ctx.discordGuildId)
      for (const r of rows) {
        await logDiscordAudit('role_remove', {
          discord_user_id: r.discord_user_id,
          discord_role_id: r.discord_role_id,
          reason: 'grace_expiry',
        }, ctx.discordGuildId)
      }
      return reply.send({
        removals: rows.map((r) => ({ discord_user_id: r.discord_user_id, discord_role_id: r.discord_role_id })),
      })
    }
  )
}
