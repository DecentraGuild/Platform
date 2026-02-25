-- Store trait_keys and trait_options for NFT/collection catalog entries so rule forms use them without refetching.
ALTER TABLE discord_guild_mints
  ADD COLUMN IF NOT EXISTS trait_index JSONB;

COMMENT ON COLUMN discord_guild_mints.trait_index IS 'For kind=NFT: { "trait_keys": string[], "trait_options": Record<string, string[]> } from collection preview. Null for SPL.';
