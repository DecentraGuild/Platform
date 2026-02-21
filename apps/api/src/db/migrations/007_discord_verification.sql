-- Discord verification module: one server per tenant, wallet links, role rules, holder snapshots

-- One Discord server per dGuild (tenant). Bot invite state optional for OAuth flow.
CREATE TABLE IF NOT EXISTS discord_servers (
  tenant_slug TEXT PRIMARY KEY,
  discord_guild_id TEXT NOT NULL UNIQUE,
  guild_name TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  bot_invite_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_servers_guild_id ON discord_servers(discord_guild_id);

-- Global wallet -> Discord user link. One wallet maps to exactly one Discord user; one Discord user may have multiple wallets.
CREATE TABLE IF NOT EXISTS wallet_discord_links (
  wallet_address TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_discord_links_discord_user ON wallet_discord_links(discord_user_id);

-- Role rule: which Discord role to assign when conditions are met. operator = AND | OR across conditions.
CREATE TABLE IF NOT EXISTS discord_role_rules (
  id SERIAL PRIMARY KEY,
  discord_guild_id TEXT NOT NULL,
  discord_role_id TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'AND' CHECK (operator IN ('AND', 'OR')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (discord_guild_id, discord_role_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_role_rules_guild ON discord_role_rules(discord_guild_id);

-- Condition for a role rule: SPL threshold, NFT collection, or trait filter.
CREATE TABLE IF NOT EXISTS discord_role_conditions (
  id SERIAL PRIMARY KEY,
  role_rule_id INTEGER NOT NULL REFERENCES discord_role_rules(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SPL', 'NFT', 'TRAIT')),
  mint_or_group TEXT NOT NULL,
  threshold NUMERIC,
  trait_key TEXT,
  trait_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_role_conditions_rule ON discord_role_conditions(role_rule_id);

-- Holder snapshot per asset (mint or collection group). holder_wallets JSONB array of wallet addresses.
CREATE TABLE IF NOT EXISTS discord_holder_snapshots (
  asset_id TEXT PRIMARY KEY,
  holder_wallets JSONB NOT NULL DEFAULT '[]',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_holder_snapshots_updated ON discord_holder_snapshots(last_updated);

-- Audit log for Discord module: server link/unlink, rule CRUD, role changes, verify/link.
CREATE TABLE IF NOT EXISTS discord_audit_log (
  id SERIAL PRIMARY KEY,
  discord_guild_id TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_audit_log_guild ON discord_audit_log(discord_guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_audit_log_created ON discord_audit_log(created_at);
