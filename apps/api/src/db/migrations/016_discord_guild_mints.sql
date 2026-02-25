-- Per-guild mint catalog: SPL tokens and NFT collections configured once, then selected by dropdown in rule creation.
-- Rules still store raw asset_id in condition payload; this table is the UX layer for admins.

CREATE TABLE IF NOT EXISTS discord_guild_mints (
  id SERIAL PRIMARY KEY,
  discord_guild_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('SPL', 'NFT')),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (discord_guild_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_mints_guild ON discord_guild_mints(discord_guild_id);
