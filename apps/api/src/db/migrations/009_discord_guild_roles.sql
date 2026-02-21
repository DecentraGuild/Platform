-- Cached Discord roles per guild for admin dropdown. Bot syncs via POST /discord/bot/roles.
CREATE TABLE IF NOT EXISTS discord_guild_roles (
  discord_guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (discord_guild_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_roles_guild ON discord_guild_roles(discord_guild_id);
