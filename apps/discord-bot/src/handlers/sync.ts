import type { Guild } from 'discord.js'
import {
  getBotContext,
  syncGuildRoles,
  syncHoldersForGuild,
  getEligible,
  scheduleRemovals,
  getPendingRemovals,
} from '../api-client.js'
import { API_BASE_URL, DISCORD_BOT_API_SECRET } from '../config.js'

/** Build member_roles map for the guild (user id -> role ids). Excludes @everyone. */
export async function getMemberRolesForGuild(guild: Guild): Promise<Record<string, string[]>> {
  const members = await guild.members.fetch()
  const memberRoles: Record<string, string[]> = {}
  const everyoneId = guild.id
  for (const [, member] of members) {
    const roleIds = member.roles.cache
      .filter((r) => r.id !== everyoneId)
      .map((r) => r.id)
    memberRoles[member.id] = roleIds
  }
  return memberRoles
}

/** Sync holder snapshots (RPC), then compute eligible and apply/remove roles. Requires GuildMembers intent. */
export async function runRoleSyncForGuild(guild: Guild): Promise<void> {
  if (!DISCORD_BOT_API_SECRET) return
  try {
    const syncResult = await syncHoldersForGuild(API_BASE_URL, DISCORD_BOT_API_SECRET, guild.id)
    const resultCount = syncResult.results?.length ?? 0
    const totalHolders = syncResult.results?.reduce((s, r) => s + r.holderCount, 0) ?? 0
    const memberRoles = await getMemberRolesForGuild(guild)
    const { eligible } = await getEligible(API_BASE_URL, DISCORD_BOT_API_SECRET, guild.id, memberRoles)
    if (eligible.length === 0) return

    const toRemove: Array<{ discord_user_id: string; discord_role_id: string }> = []

    for (const { discord_role_id, eligible_discord_user_ids } of eligible) {
      const role = guild.roles.cache.get(discord_role_id)
      if (!role) continue

      const eligibleSet = new Set(eligible_discord_user_ids)

      for (const userId of eligible_discord_user_ids) {
        try {
          const member = await guild.members.fetch(userId).catch(() => null)
          if (member && !member.roles.cache.has(discord_role_id)) {
            await member.roles.add(role)
          }
        } catch {
          // Skip on rate limit or missing member
        }
      }

      for (const member of role.members.values()) {
        if (!eligibleSet.has(member.id)) toRemove.push({ discord_user_id: member.id, discord_role_id })
      }
    }

    if (toRemove.length > 0) {
      await scheduleRemovals(API_BASE_URL, DISCORD_BOT_API_SECRET, guild.id, toRemove)
    }

    const { removals } = await getPendingRemovals(API_BASE_URL, DISCORD_BOT_API_SECRET, guild.id)
    for (const { discord_user_id, discord_role_id } of removals) {
      try {
        const member = await guild.members.fetch(discord_user_id).catch(() => null)
        if (member) await member.roles.remove(discord_role_id)
      } catch {
        // Skip
      }
    }
  } catch (err) {
    throw err
  }
}

export async function syncLinkedGuild(guild: Guild): Promise<void> {
  if (!DISCORD_BOT_API_SECRET) return
  try {
    await getBotContext(API_BASE_URL, DISCORD_BOT_API_SECRET, guild.id)
    const roles = guild.roles.cache
      .filter((r) => !r.managed && r.id !== guild.id)
      .map((r) => ({ id: r.id, name: r.name, position: r.position }))
    const me = guild.members.me
    const botRolePosition = me?.roles?.cache?.reduce((max, r) => Math.max(max, r.position), -1) ?? -1
    await syncGuildRoles(API_BASE_URL, DISCORD_BOT_API_SECRET, guild.id, roles, botRolePosition >= 0 ? botRolePosition : undefined)
    await runRoleSyncForGuild(guild)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Guild not linked') || msg.includes('404')) return
    throw err
  }
}
