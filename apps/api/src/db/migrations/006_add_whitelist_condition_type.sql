-- Add WHITELIST to allowed condition types for Discord role rules.
ALTER TABLE discord_role_conditions DROP CONSTRAINT IF EXISTS discord_role_conditions_type_check;
ALTER TABLE discord_role_conditions ADD CONSTRAINT discord_role_conditions_type_check
  CHECK (type IN ('SPL', 'NFT', 'TRAIT', 'DISCORD', 'WHITELIST'));
