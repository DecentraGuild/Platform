-- Short-lived verify sessions: bot creates one per user, user completes sign-and-link in app.
CREATE TABLE IF NOT EXISTS discord_verify_sessions (
  token TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  discord_guild_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_verify_sessions_expires ON discord_verify_sessions(expires_at);
