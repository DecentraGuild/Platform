-- Auth nonce store for wallet sign-in: one nonce per wallet, TTL for expiry.
-- Enables multi-instance API: nonce set on one instance is visible to another.
CREATE TABLE IF NOT EXISTS auth_nonce (
  wallet TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_nonce_expires_at ON auth_nonce(expires_at);
