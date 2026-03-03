-- Raffle module settings per tenant (default whitelist, etc.)
CREATE TABLE IF NOT EXISTS raffle_settings (
  tenant_slug TEXT PRIMARY KEY,
  tenant_id TEXT,
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_settings_tenant ON raffle_settings(tenant_slug);
