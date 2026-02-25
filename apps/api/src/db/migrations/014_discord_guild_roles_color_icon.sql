-- Add Discord role display fields: color (integer hex), icon hash, unicode_emoji (ROLE_ICONS feature).
ALTER TABLE discord_guild_roles
  ADD COLUMN IF NOT EXISTS color INTEGER,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS unicode_emoji TEXT;
