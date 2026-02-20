-- Mint metadata cache for marketplace (saves RPC credits)
CREATE TABLE IF NOT EXISTS mint_metadata (
  mint TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  image TEXT,
  decimals INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mint_metadata_updated_at ON mint_metadata(updated_at);
