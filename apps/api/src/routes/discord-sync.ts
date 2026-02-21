import type { FastifyInstance } from 'fastify'
import { getPool } from '../db/client.js'
import { syncHoldersForGuild, syncAllLinkedGuilds } from '../discord/holder-sync.js'
import { requireDiscordBotAuth } from '../discord/bot-auth.js'
import { secureCompare } from '../secure-compare.js'

const SYNC_SECRET_HEADER = 'x-sync-secret'

/**
 * Internal/cron route: sync holders for all linked guilds. Requires x-sync-secret header matching DISCORD_SYNC_SECRET (or DISCORD_BOT_API_SECRET if not set).
 */
export async function registerDiscordSyncRoutes(app: FastifyInstance) {
  const syncSecret = () => process.env.DISCORD_SYNC_SECRET ?? process.env.DISCORD_BOT_API_SECRET

  app.post('/api/v1/discord/sync-holders', async (request, reply) => {
    if (!getPool()) {
      return reply.status(503).send({ error: 'Database not available' })
    }
    const secret = syncSecret()
    if (!secret) {
      return reply.status(503).send({ error: 'Sync not configured (set DISCORD_SYNC_SECRET or DISCORD_BOT_API_SECRET)' })
    }
    const provided = (request.headers[SYNC_SECRET_HEADER] as string)?.trim()
    if (!provided || !secureCompare(provided, secret)) {
      return reply.status(401).send({ error: 'Invalid sync secret' })
    }
    try {
      await syncAllLinkedGuilds(request.log)
      return reply.send({ ok: true })
    } catch (err) {
      request.log.error({ err }, 'Holder sync failed')
      return reply.status(500).send({ error: 'Sync failed' })
    }
  })

  app.post<{ Body: { discord_guild_id?: string } }>(
    '/api/v1/discord/bot/sync-holders',
    { preHandler: [requireDiscordBotAuth] },
    async (request, reply) => {
      const ctx = request.discordContext!
      try {
        const results = await syncHoldersForGuild(ctx.discordGuildId, {
          ingestMintMetadata: true,
          log: request.log,
        })
        return reply.send({ ok: true, results })
      } catch (err) {
        request.log.error({ err }, 'Holder sync failed for guild')
        return reply.status(500).send({ error: 'Sync failed' })
      }
    }
  )
}
