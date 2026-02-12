-- Tenant config table for Postgres (Railway)
CREATE TABLE IF NOT EXISTS tenant_config (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
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
