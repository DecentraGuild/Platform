-- Initial schema (merged from migrations 001-019). Fresh DB only.
-- Note: tenant_slug columns store tenant id (canonical) or slug; id is canonical, slug/custom domain are layers on top.

-- Tenant config
CREATE TABLE IF NOT EXISTS tenant_config (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  branding JSONB DEFAULT '{}',
  modules JSONB DEFAULT '[]',
  admins JSONB DEFAULT '[]',
  treasury TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_config_slug ON tenant_config(slug);

-- Mint metadata cache
CREATE TABLE IF NOT EXISTS mint_metadata (
  mint TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  image TEXT,
  decimals INTEGER,
  traits JSONB,
  seller_fee_basis_points INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mint_metadata_updated_at ON mint_metadata(updated_at);

-- Marketplace settings
CREATE TABLE IF NOT EXISTS marketplace_settings (
  tenant_slug TEXT PRIMARY KEY,
  tenant_id TEXT,
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_settings_tenant_slug ON marketplace_settings(tenant_slug);

-- Marketplace mint scope
CREATE TABLE IF NOT EXISTS marketplace_mint_scope (
  tenant_slug TEXT NOT NULL,
  mint TEXT NOT NULL,
  source TEXT NOT NULL,
  collection_mint TEXT,
  PRIMARY KEY (tenant_slug, mint)
);

CREATE INDEX IF NOT EXISTS idx_mint_scope_tenant ON marketplace_mint_scope(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_mint_scope_collection ON marketplace_mint_scope(tenant_slug, collection_mint) WHERE collection_mint IS NOT NULL;

-- Discord verification: one server per tenant
CREATE TABLE IF NOT EXISTS discord_servers (
  tenant_slug TEXT PRIMARY KEY,
  discord_guild_id TEXT NOT NULL UNIQUE,
  guild_name TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  bot_invite_state TEXT,
  bot_role_position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_servers_guild_id ON discord_servers(discord_guild_id);

-- Wallet <-> Discord links
CREATE TABLE IF NOT EXISTS wallet_discord_links (
  wallet_address TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_discord_links_discord_user ON wallet_discord_links(discord_user_id);

-- Discord role rules
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

-- Discord role conditions (type-first, payload JSONB)
CREATE TABLE IF NOT EXISTS discord_role_conditions (
  id SERIAL PRIMARY KEY,
  role_rule_id INTEGER NOT NULL REFERENCES discord_role_rules(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SPL', 'NFT', 'TRAIT', 'DISCORD')),
  payload JSONB NOT NULL DEFAULT '{}',
  logic_to_next TEXT CHECK (logic_to_next IS NULL OR logic_to_next IN ('AND', 'OR')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_role_conditions_rule ON discord_role_conditions(role_rule_id);

-- Holder snapshots
CREATE TABLE IF NOT EXISTS discord_holder_snapshots (
  asset_id TEXT PRIMARY KEY,
  holder_wallets JSONB NOT NULL DEFAULT '[]',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_holder_snapshots_updated ON discord_holder_snapshots(last_updated);

-- Discord audit log
CREATE TABLE IF NOT EXISTS discord_audit_log (
  id SERIAL PRIMARY KEY,
  discord_guild_id TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_audit_log_guild ON discord_audit_log(discord_guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_audit_log_created ON discord_audit_log(created_at);

-- Verify sessions
CREATE TABLE IF NOT EXISTS discord_verify_sessions (
  token TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  discord_guild_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_verify_sessions_expires ON discord_verify_sessions(expires_at);

-- Role removal queue
CREATE TABLE IF NOT EXISTS discord_role_removal_queue (
  id SERIAL PRIMARY KEY,
  discord_guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_role_id TEXT NOT NULL,
  scheduled_remove_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_removal_queue_guild_scheduled ON discord_role_removal_queue(discord_guild_id, scheduled_remove_at);

-- Guild roles cache
CREATE TABLE IF NOT EXISTS discord_guild_roles (
  discord_guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color INTEGER,
  icon TEXT,
  unicode_emoji TEXT,
  PRIMARY KEY (discord_guild_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_roles_guild ON discord_guild_roles(discord_guild_id);

-- Guild mints catalog
CREATE TABLE IF NOT EXISTS discord_guild_mints (
  id SERIAL PRIMARY KEY,
  discord_guild_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('SPL', 'NFT')),
  label TEXT NOT NULL,
  trait_index JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (discord_guild_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_guild_mints_guild ON discord_guild_mints(discord_guild_id);

-- Auth nonce store
CREATE TABLE IF NOT EXISTS auth_nonce (
  wallet TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_nonce_expires_at ON auth_nonce(expires_at);

-- Billing
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL,
  module_id TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  recurring_amount_usdc NUMERIC(12,6) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  conditions_snapshot JSONB NOT NULL DEFAULT '{}',
  price_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_slug, module_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant ON billing_subscriptions(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_period_end ON billing_subscriptions(period_end);

CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL,
  module_id TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('initial', 'upgrade_prorate', 'renewal', 'extend')),
  amount_usdc NUMERIC(12,6) NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  memo TEXT NOT NULL,
  payer_wallet TEXT NOT NULL,
  conditions_snapshot JSONB,
  price_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_tenant ON billing_payments(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON billing_payments(status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_expires_at ON billing_payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_billing_payments_tx_signature ON billing_payments(tx_signature);
