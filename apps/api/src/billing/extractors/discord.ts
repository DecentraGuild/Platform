import type { ConditionSet } from '@decentraguild/billing'
import { getDiscordServerByTenantSlug } from '../../db/discord-servers.js'
import { getDiscordMintsByGuildId } from '../../db/discord-guild-mints.js'
import { getPool } from '../../db/client.js'

export async function extractDiscordConditions(tenantId: string): Promise<ConditionSet> {
  if (!getPool()) return { mintsCount: 0 }

  const server = await getDiscordServerByTenantSlug(tenantId)
  if (!server) return { mintsCount: 0 }

  const mints = await getDiscordMintsByGuildId(server.discord_guild_id)
  return { mintsCount: mints.length }
}
