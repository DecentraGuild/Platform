CREATE TABLE IF NOT EXISTS marketplace_mint_scope (
  tenant_slug TEXT NOT NULL,
  mint TEXT NOT NULL,
  source TEXT NOT NULL,
  collection_mint TEXT,
  PRIMARY KEY (tenant_slug, mint)
);

CREATE INDEX IF NOT EXISTS idx_mint_scope_tenant ON marketplace_mint_scope(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_mint_scope_collection ON marketplace_mint_scope(tenant_slug, collection_mint) WHERE collection_mint IS NOT NULL;
