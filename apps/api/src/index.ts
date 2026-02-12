import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { registerTenantContextRoutes } from './routes/tenant-context.js'
import { registerTenantSettingsRoutes } from './routes/tenant-settings.js'
import { registerTenantsRoutes } from './routes/tenants.js'
import { registerAuthRoutes } from './routes/auth.js'
import { initPool, query } from './db/client.js'
import { upsertTenant } from './db/tenant.js'
import { getTenantConfigDir, loadTenantBySlug, loadTenantBySlugDiagnostic } from './config/registry.js'

function ensureTenantConfigPath(): void {
  if (process.env.TENANT_CONFIG_PATH) return
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const repoConfigs = path.resolve(dirname, '../../../configs/tenants')
  try {
    readFileSync(path.join(repoConfigs, 'skull.json'), 'utf-8')
    process.env.TENANT_CONFIG_PATH = repoConfigs
  } catch {
    // not in monorepo or configs missing; loader will use cwd fallbacks
  }
}
ensureTenantConfigPath()

const app = Fastify({ logger: true })

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

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
  try {
    await query(MIGRATION_001)
  } catch (e) {
    app.log.warn({ err: e }, 'Migration skipped (table may exist)')
  }
}

async function seedSkull() {
  const skull = await loadTenantBySlug('skull')
  if (skull) await upsertTenant(skull)
}

async function main() {
  await app.register(cors, {
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  })

  const cookie = await import('@fastify/cookie')
  await app.register(cookie)

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    initPool(databaseUrl)
    await runMigrations()
    await seedSkull()
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
  await registerAuthRoutes(app)
  await registerTenantContextRoutes(app)
  await registerTenantSettingsRoutes(app)
  await registerTenantsRoutes(app)

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info({ port, tenantConfigPath: process.env.TENANT_CONFIG_PATH ?? null }, 'API ready')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
