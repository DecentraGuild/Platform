/**
 * Ensures TENANT_CONFIG_PATH and MARKETPLACE_CONFIG_PATH are set when running in monorepo.
 * Shared by API server (index.ts) and worker (worker.ts).
 */

import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function ensureConfigPaths(): void {
  const repoRoot = path.resolve(__dirname, '../../..')
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
