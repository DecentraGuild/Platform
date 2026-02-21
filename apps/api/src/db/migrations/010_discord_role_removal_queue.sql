-- Grace queue for role removals: schedule remove at (now + grace delay), bot claims due rows and applies.
CREATE TABLE IF NOT EXISTS discord_role_removal_queue (
  id SERIAL PRIMARY KEY,
  discord_guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_role_id TEXT NOT NULL,
  scheduled_remove_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_removal_queue_guild_scheduled ON discord_role_removal_queue(discord_guild_id, scheduled_remove_at);
