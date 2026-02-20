CREATE TABLE IF NOT EXISTS marketplace_settings (
  tenant_slug TEXT PRIMARY KEY,
  tenant_id TEXT,
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_settings_tenant_slug ON marketplace_settings(tenant_slug);
