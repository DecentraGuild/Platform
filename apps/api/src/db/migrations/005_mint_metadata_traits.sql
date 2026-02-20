-- Add traits (attributes) to mint metadata for NFT display
ALTER TABLE mint_metadata ADD COLUMN IF NOT EXISTS traits JSONB DEFAULT NULL;
