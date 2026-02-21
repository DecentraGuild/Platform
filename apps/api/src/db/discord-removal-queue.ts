import { query } from './client.js'

const GRACE_MINUTES = 60

export interface RemovalQueueRow {
  id: number
  discord_guild_id: string
  discord_user_id: string
  discord_role_id: string
  scheduled_remove_at: string
  created_at: string
}

export async function scheduleRemovalsBatch(
  discordGuildId: string,
  removals: Array<{ discord_user_id: string; discord_role_id: string }>
): Promise<number> {
  if (removals.length === 0) return 0
  const scheduledAt = new Date(Date.now() + GRACE_MINUTES * 60 * 1000)
  for (const r of removals) {
    await query(
      `INSERT INTO discord_role_removal_queue (discord_guild_id, discord_user_id, discord_role_id, scheduled_remove_at)
       VALUES ($1, $2, $3, $4)`,
      [discordGuildId, r.discord_user_id, r.discord_role_id, scheduledAt.toISOString()]
    )
  }
  return removals.length
}

/** Get and delete all due removals for the guild. Returns claimed rows for bot to apply. */
export async function getAndClaimDueRemovals(discordGuildId: string): Promise<RemovalQueueRow[]> {
  const { rows } = await query<RemovalQueueRow>(
    `DELETE FROM discord_role_removal_queue
     WHERE discord_guild_id = $1 AND scheduled_remove_at <= NOW()
     RETURNING *`,
    [discordGuildId]
  )
  return rows
}
