import 'dotenv/config'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { buildCorsOrigin } from './cors.js'
import { registerTenantContextRoutes } from './routes/tenant-context.js'
import { registerTenantSettingsRoutes } from './routes/tenant-settings.js'
import { registerMarketplaceMetadataRoutes } from './routes/marketplace-metadata.js'
import { registerMarketplaceScopeRoutes } from './routes/marketplace-scope.js'
import { registerMarketplaceEscrowsRoutes } from './routes/marketplace-escrows.js'
import { registerTenantsRoutes } from './routes/tenants.js'
import { registerAuthRoutes } from './routes/auth.js'
import { initPool, query } from './db/client.js'
import { upsertTenant } from './db/tenant.js'
import { getTenantConfigDir, loadTenantBySlug, loadTenantBySlugDiagnostic } from './config/registry.js'
import { loadMarketplaceBySlug, listMarketplaceSlugs } from './config/marketplace-registry.js'
import { upsertMarketplace } from './db/marketplace-settings.js'
import { upsertMintMetadata } from './db/marketplace-metadata.js'
import { expandAndSaveScope } from './marketplace/expand-collections.js'
import type { MarketplaceConfig } from './config/marketplace-registry.js'

function ensureConfigPaths(): void {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(dirname, '../../..')
  if (!process.env.TENANT_CONFIG_PATH) {
    const tenantConfigs = path.join(repoRoot, 'configs/tenants')
    try {
      readFileSync(path.join(tenantConfigs, 'skull.json'), 'utf-8')
      process.env.TENANT_CONFIG_PATH = tenantConfigs
    } catch {
      // not in monorepo or configs missing
    }
  }
  if (!process.env.MARKETPLACE_CONFIG_PATH) {
    const marketplaceConfigs = path.join(repoRoot, 'configs/marketplace')
    try {
      readFileSync(path.join(marketplaceConfigs, 'skull.json'), 'utf-8')
      process.env.MARKETPLACE_CONFIG_PATH = marketplaceConfigs
    } catch {
      // not in monorepo or configs missing
    }
  }
}
ensureConfigPaths()

const app = Fastify({ logger: true })

const MIGRATION_005 = `
ALTER TABLE mint_metadata ADD COLUMN IF NOT EXISTS traits JSONB DEFAULT NULL;
`

const MIGRATION_006 = `
ALTER TABLE mint_metadata ADD COLUMN IF NOT EXISTS seller_fee_basis_points INTEGER DEFAULT NULL;
`

const MIGRATION_004 = `
CREATE TABLE IF NOT EXISTS marketplace_mint_scope (
  tenant_slug TEXT NOT NULL,
  mint TEXT NOT NULL,
  source TEXT NOT NULL,
  collection_mint TEXT,
  PRIMARY KEY (tenant_slug, mint)
);
CREATE INDEX IF NOT EXISTS idx_mint_scope_tenant ON marketplace_mint_scope(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_mint_scope_collection ON marketplace_mint_scope(tenant_slug, collection_mint) WHERE collection_mint IS NOT NULL;
`

const MIGRATION_003 = `
CREATE TABLE IF NOT EXISTS marketplace_settings (
  tenant_slug TEXT PRIMARY KEY,
  tenant_id TEXT,
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_tenant_slug ON marketplace_settings(tenant_slug);
`

const MIGRATION_002 = `
CREATE TABLE IF NOT EXISTS mint_metadata (
  mint TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  image TEXT,
  decimals INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mint_metadata_updated_at ON mint_metadata(updated_at);
`

const MIGRATION_001 = `
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
`

async function runMigrations() {
  for (const sql of [MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004, MIGRATION_005, MIGRATION_006]) {
    try {
      await query(sql)
    } catch (e) {
      app.log.warn({ err: e }, 'Migration skipped (table may exist)')
    }
  }
}

/** Known decimals for common currency mints (local seed fallback) */
const KNOWN_DECIMALS: Record<string, number> = {
  So11111111111111111111111111111111111111112: 9,
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 8,
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6,
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 6,
  ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx: 8,
  poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk: 6,
}

async function seedMintMetadataFromConfig(config: MarketplaceConfig): Promise<void> {
  for (const { mint, name, image, sellerFeeBasisPoints } of config.collectionMints) {
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), {
      name: name ?? null,
      symbol: null,
      image: image ?? null,
      sellerFeeBasisPoints: sellerFeeBasisPoints ?? null,
    }).catch(() => {})
  }
  for (const c of config.currencyMints) {
    const { mint, name, symbol, image, decimals, sellerFeeBasisPoints } = c
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), {
      name: name ?? null,
      symbol: symbol ?? null,
      image: image ?? null,
      decimals: decimals ?? KNOWN_DECIMALS[mint] ?? null,
      sellerFeeBasisPoints: sellerFeeBasisPoints ?? null,
    }).catch(() => {})
  }
  for (const s of config.splAssetMints ?? []) {
    const { mint, name, symbol, image, decimals, sellerFeeBasisPoints } = s
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), {
      name: name ?? null,
      symbol: symbol ?? null,
      image: image ?? null,
      decimals: decimals ?? null,
      sellerFeeBasisPoints: sellerFeeBasisPoints ?? null,
    }).catch(() => {})
  }
}

async function seedSkull(app: { log: { warn: (obj: unknown, msg?: string) => void } }) {
  const skull = await loadTenantBySlug('skull')
  if (skull) await upsertTenant(skull)
  const marketplace = await loadMarketplaceBySlug('skull')
  if (marketplace) {
    await upsertMarketplace('skull', marketplace.tenantId, marketplace)
    try {
      await seedMintMetadataFromConfig(marketplace)
    } catch (e) {
      app.log.warn({ err: e }, 'Mint metadata seed failed')
    }
    try {
      await expandAndSaveScope('skull', marketplace, app.log)
    } catch (e) {
      app.log.warn({ err: e }, 'Scope expansion failed during seed')
    }
  }
  const slugs = await listMarketplaceSlugs()
  for (const slug of slugs) {
    if (slug === 'skull') continue
    const config = await loadMarketplaceBySlug(slug)
    if (config) {
      try {
        await seedMintMetadataFromConfig(config)
      } catch (e) {
        app.log.warn({ err: e, slug }, 'Mint metadata seed failed')
      }
    }
  }
}

async function main() {
  await app.register(cors, {
    origin: buildCorsOrigin(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  const cookie = await import('@fastify/cookie')
  await app.register(cookie)

  const rateLimit = await import('@fastify/rate-limit')
  await app.register(rateLimit.default, {
    max: Number(process.env.RATE_LIMIT_MAX) || 200,
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
  })

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    initPool(databaseUrl)
    await runMigrations()
    void seedSkull(app).catch((e) => app.log.warn({ err: e }, 'Seed failed (scope may be empty)'))
  }

  app.get('/', async (_req, reply) => {
    return reply.code(200).send({
      name: 'DecentraGuild API',
      version: '1',
      docs: 'API is under /api/v1/. Use GET /api/v1/health for health check.',
    })
  })
  app.get('/api/v1/health', async () => {
    const tenantConfigPath = getTenantConfigDir()
    const tenantConfigOk = Boolean(tenantConfigPath && (await loadTenantBySlug('skull')))
    return { status: 'ok', tenantConfigPath: tenantConfigPath ?? null, tenantConfigOk }
  })
  app.get('/api/v1/debug/tenant-config', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'Not found' })
    }
    const slug = new URL(request.url, 'http://localhost').searchParams.get('slug') ?? 'skull'
    return reply.send(await loadTenantBySlugDiagnostic(slug))
  })
  app.post('/api/v1/debug/seed-metadata', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'Not found' })
    }
    const slugs = await listMarketplaceSlugs()
    let seeded = 0
    for (const slug of slugs) {
      const config = await loadMarketplaceBySlug(slug)
      if (config) {
        try {
          await seedMintMetadataFromConfig(config)
          seeded++
        } catch (e) {
          app.log.warn({ err: e, slug }, 'Mint metadata seed failed')
        }
      }
    }
    return { ok: true, configsSeeded: seeded }
  })
  await registerAuthRoutes(app)
  await registerTenantContextRoutes(app)
  await registerTenantSettingsRoutes(app)
  await registerMarketplaceMetadataRoutes(app)
  await registerMarketplaceScopeRoutes(app)
  await registerMarketplaceEscrowsRoutes(app)
  await registerTenantsRoutes(app)

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info({ port, tenantConfigPath: process.env.TENANT_CONFIG_PATH ?? null }, 'API ready')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
