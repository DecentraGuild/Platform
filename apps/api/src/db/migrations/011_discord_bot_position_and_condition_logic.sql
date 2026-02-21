-- Bot can only assign roles below its highest role. Store bot's role position when it syncs.
ALTER TABLE discord_servers
  ADD COLUMN IF NOT EXISTS bot_role_position INTEGER;

-- Per-condition AND/OR: logic_to_next applies between this condition and the next (left-to-right evaluation).
ALTER TABLE discord_role_conditions
  ADD COLUMN IF NOT EXISTS logic_to_next TEXT CHECK (logic_to_next IS NULL OR logic_to_next IN ('AND', 'OR'));
