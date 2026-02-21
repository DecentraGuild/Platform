import 'dotenv/config'
import { readdirSync, readFileSync } from 'node:fs'
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
import { registerDiscordBotRoutes } from './routes/discord-bot.js'
import { registerDiscordVerifyRoutes } from './routes/discord-verify.js'
import { registerDiscordServerRoutes } from './routes/discord-server.js'
import { registerDiscordRulesRoutes } from './routes/discord-rules.js'
import { registerDiscordSyncRoutes } from './routes/discord-sync.js'
import { initPool, getPool } from './db/client.js'
import { syncAllLinkedGuilds } from './discord/holder-sync.js'
import { runMigrations } from './db/run-migrations.js'
import { upsertTenant } from './db/tenant.js'
import { getTenantConfigDir, loadTenantBySlug, loadTenantBySlugDiagnostic, listTenantSlugs } from './config/registry.js'
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
      const files = readdirSync(tenantConfigs)
      if (files.some((f) => f.endsWith('.json'))) {
        process.env.TENANT_CONFIG_PATH = tenantConfigs
      }
    } catch {
      // not in monorepo or configs missing
    }
  }
  if (!process.env.MARKETPLACE_CONFIG_PATH) {
    const marketplaceConfigs = path.join(repoRoot, 'configs/marketplace')
    try {
      const files = readdirSync(marketplaceConfigs)
      if (files.some((f) => f.endsWith('.json'))) {
        process.env.MARKETPLACE_CONFIG_PATH = marketplaceConfigs
      }
    } catch {
      // not in monorepo or configs missing
    }
  }
}
ensureConfigPaths()

const app = Fastify({ logger: true })

/** Known decimals for common currency mints (local seed fallback) */
const KNOWN_DECIMALS: Record<string, number> = {
  So11111111111111111111111111111111111111112: 9,
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 8,
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6,
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 6,
  ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx: 8,
  poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk: 6,
}

type SeedLog = { warn: (obj: unknown, msg?: string) => void }

async function seedMintMetadataFromConfig(
  config: MarketplaceConfig,
  log?: SeedLog
): Promise<void> {
  const onUpsertFail = (err: unknown, mint: string) => {
    if (log) log.warn({ err, mint }, 'Mint metadata upsert skipped')
  }
  for (const { mint, name, image, sellerFeeBasisPoints } of config.collectionMints) {
    if (!mint?.trim()) continue
    await upsertMintMetadata(mint.trim(), {
      name: name ?? null,
      symbol: null,
      image: image ?? null,
      sellerFeeBasisPoints: sellerFeeBasisPoints ?? null,
    }).catch((e) => onUpsertFail(e, mint.trim()))
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
    }).catch((e) => onUpsertFail(e, mint.trim()))
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
    }).catch((e) => onUpsertFail(e, mint.trim()))
  }
}

/** Seed all tenants and marketplace configs from registry (DB + metadata + scope). */
async function seedDefaultTenants(app: { log: { warn: (obj: unknown, msg?: string) => void } }) {
  const tenantSlugs = await listTenantSlugs()
  for (const slug of tenantSlugs) {
    const tenant = await loadTenantBySlug(slug)
    if (tenant) await upsertTenant(tenant)
  }
  const marketplaceSlugs = await listMarketplaceSlugs()
  for (const slug of marketplaceSlugs) {
    const config = await loadMarketplaceBySlug(slug)
    if (!config) continue
    const tenant = await loadTenantBySlug(slug)
    if (tenant) await upsertTenant(tenant)
    await upsertMarketplace(slug, config.tenantId, config)
    try {
      await seedMintMetadataFromConfig(config, app.log)
    } catch (e) {
      app.log.warn({ err: e, slug }, 'Mint metadata seed failed')
    }
    try {
      await expandAndSaveScope(slug, config, app.log)
    } catch (e) {
      app.log.warn({ err: e, slug }, 'Scope expansion failed during seed')
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
    await runMigrations(app.log)
    void seedDefaultTenants(app).catch((e) => app.log.warn({ err: e }, 'Seed failed (scope may be empty)'))
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
    const slugs = await listTenantSlugs()
    const tenantConfigOk = Boolean(tenantConfigPath && slugs.length > 0)
    return { status: 'ok', tenantConfigPath: tenantConfigPath ?? null, tenantConfigOk }
  })
  app.get('/api/v1/debug/tenant-config', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'Not found' })
    }
    const slugParam = new URL(request.url, 'http://localhost').searchParams.get('slug')?.trim()
    const slugs = await listTenantSlugs()
    const slug = slugParam || (slugs[0] ?? null)
    if (!slug) {
      return reply.code(400).send({ error: 'No tenant configs found; use ?slug=<slug> when configs exist' })
    }
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
          await seedMintMetadataFromConfig(config, app.log)
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
  await registerDiscordBotRoutes(app)
  await registerDiscordVerifyRoutes(app)
  await registerDiscordServerRoutes(app)
  await registerDiscordRulesRoutes(app)
  await registerDiscordSyncRoutes(app)

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info({ port, tenantConfigPath: process.env.TENANT_CONFIG_PATH ?? null }, 'API ready')

  const syncIntervalMinutes = Number(process.env.DISCORD_SYNC_INTERVAL_MINUTES ?? 0)
  if (syncIntervalMinutes > 0 && getPool()) {
    const runSync = () => {
      syncAllLinkedGuilds(app.log).catch((err) => app.log.error({ err }, 'Scheduled Discord holder sync failed'))
    }
    runSync()
    setInterval(runSync, syncIntervalMinutes * 60 * 1000)
    app.log.info({ intervalMinutes: syncIntervalMinutes }, 'Discord holder sync scheduled (on boot and every N min)')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
