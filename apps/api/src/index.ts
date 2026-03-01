import 'dotenv/config'
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
import { registerBillingRoutes } from './routes/billing.js'
import { registerBillingPaymentRoutes } from './routes/billing-payments.js'
import { registerRegisterRoutes } from './routes/register.js'
import { initPool, getPool } from './db/client.js'
import { apiError, ErrorCode } from './api-errors.js'
import { runMigrations } from './db/run-migrations.js'
import { upsertTenant } from './db/tenant.js'
import { normalizeTenantIdentifier } from './validate-slug.js'
import { getTenantConfigDir, loadTenantByIdOrSlug, loadTenantBySlugDiagnostic, listTenantSlugs } from './config/registry.js'
import { loadMarketplaceBySlug, listMarketplaceSlugs } from './config/marketplace-registry.js'
import { ensureConfigPaths } from './config/ensure-paths.js'
import {
  DEFAULT_PORT,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW,
} from './config/constants.js'
import { upsertMarketplace } from './db/marketplace-settings.js'
import { upsertMintMetadata } from './db/marketplace-metadata.js'
import { expandAndSaveScope } from './marketplace/expand-collections.js'
import { setSeedCompleted, isSeedPending } from './seed-state.js'
import type { MarketplaceConfig } from './config/marketplace-registry.js'

ensureConfigPaths()

const app = Fastify({ logger: true })

app.setErrorHandler((err: unknown, request, reply) => {
  const msg = err instanceof Error ? err.message : 'Unhandled error'
  request.log.error({ err }, msg)
  const message = err instanceof Error ? err.message : 'Internal server error'
  const body = apiError(message, ErrorCode.INTERNAL_ERROR)
  if (process.env.NODE_ENV !== 'production' && err instanceof Error && err.stack) {
    (body as Record<string, unknown>).stack = err.stack
  }
  return reply.status(500).send(body)
})

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
  const tenantIds = await listTenantSlugs()
  for (const idOrSlug of tenantIds) {
    const tenant = await loadTenantByIdOrSlug(idOrSlug)
    if (tenant) await upsertTenant(tenant)
  }
  const marketplaceIds = await listMarketplaceSlugs()
  for (const idOrSlug of marketplaceIds) {
    const config = await loadMarketplaceBySlug(idOrSlug)
    if (!config) continue
    const tenant = await loadTenantByIdOrSlug(idOrSlug)
    if (tenant) await upsertTenant(tenant)
    const tenantId = tenant?.id ?? config.tenantId ?? idOrSlug
    await upsertMarketplace(tenantId, config.tenantId ?? tenantId, config)
    try {
      await seedMintMetadataFromConfig(config, app.log)
    } catch (e) {
      app.log.warn({ err: e, tenantId }, 'Mint metadata seed failed')
    }
    try {
      await expandAndSaveScope(tenantId, config, app.log)
    } catch (e) {
      app.log.warn({ err: e, tenantId }, 'Scope expansion failed during seed')
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    app.log.error('DATABASE_URL is required in production')
    process.exit(1)
  }

  await app.register(cors, {
    origin: buildCorsOrigin(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  const cookie = await import('@fastify/cookie')
  await app.register(cookie)

  const rateLimit = await import('@fastify/rate-limit')
  await app.register(rateLimit.default, {
    max: Number(process.env.RATE_LIMIT_MAX) || DEFAULT_RATE_LIMIT_MAX,
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? DEFAULT_RATE_LIMIT_WINDOW,
  })

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    initPool(databaseUrl)
    await runMigrations(app.log)
    // Fire-and-forget: server is ready immediately; first requests may see empty scope until seed completes.
    // If the process exits before seed finishes (e.g. short-lived deploy), scope stays empty until next start.
    void seedDefaultTenants(app)
      .then(() => setSeedCompleted())
      .catch((e) => {
        app.log.warn({ err: e }, 'Seed failed (scope may be empty)')
        setSeedCompleted()
      })
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
    return {
      status: 'ok',
      tenantConfigPath: tenantConfigPath ?? null,
      tenantConfigOk,
      seedPending: databaseUrl ? isSeedPending() : undefined,
    }
  })
  app.get('/api/v1/debug/tenant-config', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send(apiError('Not found', ErrorCode.NOT_FOUND))
    }
    const slugParam = new URL(request.url, 'http://localhost').searchParams.get('slug')?.trim()
    const slugs = await listTenantSlugs()
    const slug = slugParam
      ? normalizeTenantIdentifier(slugParam)
      : (slugs[0] ?? null)
    if (!slug) {
      return reply.code(400).send(
        apiError(
          slugParam ? 'Invalid tenant slug' : 'No tenant configs found; use ?slug=<slug> when configs exist',
          ErrorCode.BAD_REQUEST
        )
      )
    }
    return reply.send(await loadTenantBySlugDiagnostic(slug))
  })
  app.post('/api/v1/debug/seed-metadata', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(404).send(apiError('Not found', ErrorCode.NOT_FOUND))
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
  await registerBillingRoutes(app)
  await registerBillingPaymentRoutes(app)
  await registerRegisterRoutes(app)

  const port = Number(process.env.PORT) || DEFAULT_PORT
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info({ port, tenantConfigPath: process.env.TENANT_CONFIG_PATH ?? null }, 'API ready')
  // Scheduled jobs (Discord holder sync, module lifecycle) run in a separate worker process; see src/worker.ts.
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
