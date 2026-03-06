/**
 * Standalone seed: load tenant and marketplace configs from JSON into DB.
 * Use when you want to move dev config into the DB (e.g. before deploy). The API
 * never syncs from JSON automatically; with DATABASE_URL set, it uses the DB only.
 *
 * Requires: DATABASE_URL.
 * Config paths: set SEED_TENANTS_PATH and/or SEED_MARKETPLACE_PATH to override;
 * otherwise ensureConfigPaths() uses repo configs/ when run from monorepo root.
 *
 * Run from repo root: pnpm --filter api run seed:tenants
 * Or from apps/api: pnpm run seed:tenants
 */

import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initPool } from '../src/db/client.js'
import { runMigrations } from '../src/db/run-migrations.js'
import { ensureConfigPaths } from '../src/config/ensure-paths.js'
import { runSeedFromRegistry } from '../src/seed-from-registry.js'
import { getTenantConfigDir } from '../src/config/registry.js'
import { getMarketplaceConfigDir } from '../src/config/marketplace-registry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Monorepo root: from apps/api/scripts go up to repo root. */
function getRepoRoot(): string {
  return path.resolve(__dirname, '../../..')
}

/** Resolve path: if relative, resolve against repo root so configs/tenants always means repo configs. */
function resolveSeedPath(relativeOrAbsolute: string): string {
  const p = relativeOrAbsolute.trim()
  if (path.isAbsolute(p)) return path.resolve(p)
  return path.resolve(getRepoRoot(), p)
}

const log: { warn: (obj: unknown, msg?: string) => void } = {
  warn: (obj, msg) => console.warn(msg ?? 'Warn', obj),
}

async function main() {
  if (process.env.SEED_TENANTS_PATH) {
    process.env.TENANT_CONFIG_PATH = resolveSeedPath(process.env.SEED_TENANTS_PATH)
  }
  if (process.env.SEED_MARKETPLACE_PATH) {
    process.env.MARKETPLACE_CONFIG_PATH = resolveSeedPath(process.env.SEED_MARKETPLACE_PATH)
  }
  ensureConfigPaths()

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required. Set it in .env or environment.')
    process.exit(1)
  }

  const tenantDir = getTenantConfigDir()
  if (!tenantDir) {
    console.error('No tenant config path. Set SEED_TENANTS_PATH or run from repo root so configs/tenants exists.')
    process.exit(1)
  }

  initPool(databaseUrl)
  await runMigrations(log)
  await runSeedFromRegistry(log)
  const marketplaceDir = getMarketplaceConfigDir()
  console.log('Seed complete.', {
    tenantConfigPath: tenantDir,
    marketplaceConfigPath: marketplaceDir ?? null,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
