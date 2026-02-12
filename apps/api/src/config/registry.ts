/**
 * Tenant config registry: read {slug}.json from TENANT_CONFIG_PATH.
 * Single source for static configs when DB is empty or slug not in DB.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { TenantConfig } from '@decentraguild/core'

export function getTenantConfigDir(): string | null {
  const dir = process.env.TENANT_CONFIG_PATH
  if (!dir || typeof dir !== 'string') return null
  return path.resolve(dir)
}

function parseAndValidate(raw: string): { config: TenantConfig; error: null } | { config: null; error: string } {
  try {
    const config = JSON.parse(raw) as TenantConfig
    if (!config.id || !config.slug || !config.name || !Array.isArray(config.modules)) {
      return { config: null, error: 'Config missing required fields: id, slug, name, or modules' }
    }
    if (!Array.isArray(config.admins)) config.admins = []
    return { config, error: null }
  } catch (e) {
    return { config: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function loadTenantBySlug(slug: string): Promise<TenantConfig | null> {
  const dir = getTenantConfigDir()
  if (!dir) return null
  const filePath = path.join(dir, `${slug}.json`)
  try {
    const raw = await readFile(filePath, 'utf-8')
    const out = parseAndValidate(raw)
    return out.config
  } catch {
    return null
  }
}

export interface TenantConfigDiagnostic {
  tenantConfigPath: string | null
  filePath: string | null
  fileExists: boolean
  error: string | null
  config: TenantConfig | null
}

/** For debugging: path, exists, error, and config if load succeeded. */
export async function loadTenantBySlugDiagnostic(slug: string): Promise<TenantConfigDiagnostic> {
  const tenantConfigPath = getTenantConfigDir()
  if (!tenantConfigPath) {
    return { tenantConfigPath: null, filePath: null, fileExists: false, error: 'TENANT_CONFIG_PATH not set', config: null }
  }
  const filePath = path.join(tenantConfigPath, `${slug}.json`)
  const fileExists = existsSync(filePath)
  if (!fileExists) {
    return { tenantConfigPath, filePath, fileExists: false, error: 'File not found', config: null }
  }
  try {
    const raw = await readFile(filePath, 'utf-8')
    const out = parseAndValidate(raw)
    return { tenantConfigPath, filePath, fileExists: true, error: out.error, config: out.config }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { tenantConfigPath, filePath, fileExists: true, error, config: null }
  }
}

export async function listTenantSlugs(): Promise<string[]> {
  const dir = getTenantConfigDir()
  if (!dir) return []
  try {
    const files = await readdir(dir)
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter(Boolean)
  } catch {
    return []
  }
}
