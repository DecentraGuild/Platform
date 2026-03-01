-- Discord server invite link as a general setting (not in branding).
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS discord_server_invite_link TEXT;
