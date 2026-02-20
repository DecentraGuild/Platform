/**
 * Loads tenant config from filesystem.
 * Path is configurable via TENANT_CONFIG_PATH env.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TenantConfig, TenantModulesMap } from './types.js'
import { normalizeModules } from './types.js'

const DEFAULT_CONFIG_PATH = 'configs/tenants'

function resolveConfigDir(): string {
  const envPath = process.env.TENANT_CONFIG_PATH
  if (envPath) {
    if (envPath.startsWith('/') || /^[A-Za-z]:/.test(envPath)) {
      return join(envPath, '')
    }
    return join(process.cwd(), envPath)
  }
  const cwd = process.cwd()
  const fromCwd = join(cwd, DEFAULT_CONFIG_PATH)
  if (existsSync(fromCwd)) return fromCwd
  // Monorepo: from apps/api or apps/api/dist -> repo root configs/tenants
  const monorepoFallback = join(cwd, '..', '..', 'configs', 'tenants')
  if (existsSync(monorepoFallback)) return monorepoFallback
  const monorepoFromDist = join(cwd, '..', '..', '..', 'configs', 'tenants')
  if (existsSync(monorepoFromDist)) return monorepoFromDist
  return fromCwd
}

export async function loadTenantConfig(slug: string): Promise<TenantConfig | null> {
  const basePath = resolveConfigDir()
  const filePath = join(basePath, `${slug}.json`)

  try {
    const raw = await readFile(filePath, 'utf-8')
    const config = JSON.parse(raw) as TenantConfig
    if (!config.id || !config.slug || !config.name) return null
    config.modules = normalizeModules(
      config.modules as TenantModulesMap | Array<{ id: string; enabled?: boolean }> | null | undefined
    )
    return config
  } catch {
    return null
  }
}
