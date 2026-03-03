-- Raffle list per tenant: platform-created raffles only.
-- Register on create, mark closed on close. Used for slot count (raffleSlotsUsed).
CREATE TABLE IF NOT EXISTS tenant_raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL,
  raffle_pubkey TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE (tenant_slug, raffle_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_tenant_raffles_tenant ON tenant_raffles(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_raffles_closed ON tenant_raffles(tenant_slug, closed_at) WHERE closed_at IS NULL;
