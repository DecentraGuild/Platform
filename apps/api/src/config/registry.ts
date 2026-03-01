/**
 * Tenant config registry: read/write {slug}.json from TENANT_CONFIG_PATH.
 * Single source for static configs when DB is empty or slug not in DB.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizeModules, type TenantConfig } from '@decentraguild/core'
import { isValidTenantId, isValidTenantIdentifier, isValidTenantSlug } from '../validate-slug.js'

export function getTenantConfigDir(): string | null {
  const dir = process.env.TENANT_CONFIG_PATH
  if (!dir || typeof dir !== 'string') return null
  return path.resolve(dir)
}

function parseAndValidate(raw: string, slugRequired = false): { config: TenantConfig; error: null } | { config: null; error: string } {
  try {
    const config = JSON.parse(raw) as TenantConfig & { branding?: { discordServerInviteLink?: string } }
    if (!config.id || !config.name) {
      return { config: null, error: 'Config missing required fields: id or name' }
    }
    if (slugRequired && !config.slug) {
      return { config: null, error: 'Config missing slug' }
    }
    config.modules = normalizeModules(config.modules as unknown)
    if (!Array.isArray(config.admins)) config.admins = []
    if (!config.discordServerInviteLink && config.branding?.discordServerInviteLink) {
      config.discordServerInviteLink = config.branding.discordServerInviteLink
      delete config.branding.discordServerInviteLink
    }
    return { config, error: null }
  } catch (e) {
    return { config: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function loadTenantBySlug(slug: string): Promise<TenantConfig | null> {
  if (!isValidTenantSlug(slug)) return null
  const dir = getTenantConfigDir()
  if (!dir) return null
  const filePath = path.join(dir, `${slug}.json`)
  try {
    const raw = await readFile(filePath, 'utf-8')
    const out = parseAndValidate(raw, false)
    return out.config
  } catch {
    return null
  }
}

export async function loadTenantById(id: string): Promise<TenantConfig | null> {
  if (!isValidTenantId(id)) return null
  const dir = getTenantConfigDir()
  if (!dir) return null
  const filePath = path.join(dir, `${id}.json`)
  try {
    const raw = await readFile(filePath, 'utf-8')
    const out = parseAndValidate(raw, false)
    return out.config
  } catch {
    return null
  }
}

/** Resolve tenant by id or slug. Tries slug first, then id. */
export async function loadTenantByIdOrSlug(idOrSlug: string): Promise<TenantConfig | null> {
  if (isValidTenantSlug(idOrSlug)) {
    const bySlug = await loadTenantBySlug(idOrSlug)
    if (bySlug) return bySlug
  }
  if (isValidTenantId(idOrSlug)) {
    return loadTenantById(idOrSlug)
  }
  return null
}

export interface TenantConfigDiagnostic {
  tenantConfigPath: string | null
  filePath: string | null
  fileExists: boolean
  error: string | null
  config: TenantConfig | null
}

/** For debugging: path, exists, error, and config if load succeeded. Accepts id or slug. */
export async function loadTenantBySlugDiagnostic(idOrSlug: string): Promise<TenantConfigDiagnostic> {
  if (!isValidTenantIdentifier(idOrSlug)) {
    return { tenantConfigPath: null, filePath: null, fileExists: false, error: 'Invalid id or slug', config: null }
  }
  const tenantConfigPath = getTenantConfigDir()
  if (!tenantConfigPath) {
    return { tenantConfigPath: null, filePath: null, fileExists: false, error: 'TENANT_CONFIG_PATH not set', config: null }
  }
  const filePath = path.join(tenantConfigPath, `${idOrSlug}.json`)
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

/**
 * Write tenant config to {idOrSlug}.json under TENANT_CONFIG_PATH.
 * Used when DATABASE_URL is not set (local dev) so admin save still persists.
 */
export async function writeTenantBySlug(slug: string, config: TenantConfig): Promise<void> {
  if (!isValidTenantSlug(slug)) throw new Error('Invalid tenant slug')
  const dir = getTenantConfigDir()
  if (!dir) throw new Error('TENANT_CONFIG_PATH not set')
  const filePath = path.join(dir, `${slug}.json`)
  const payload = JSON.stringify(config, null, 2)
  await writeFile(filePath, payload, 'utf-8')
}

/** Write tenant config by id or slug. Uses config.slug ?? config.id for filename when idOrSlug not provided. */
export async function writeTenantByIdOrSlug(idOrSlug: string, config: TenantConfig): Promise<void> {
  if (!isValidTenantIdentifier(idOrSlug)) throw new Error('Invalid tenant id or slug')
  const dir = getTenantConfigDir()
  if (!dir) throw new Error('TENANT_CONFIG_PATH not set')
  const filePath = path.join(dir, `${idOrSlug}.json`)
  const payload = JSON.stringify(config, null, 2)
  await writeFile(filePath, payload, 'utf-8')
}
