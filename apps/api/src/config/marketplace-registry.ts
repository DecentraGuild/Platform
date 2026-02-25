/**
 * Marketplace config registry: read/write {slug}.json from MARKETPLACE_CONFIG_PATH.
 * Linked to tenant by slug. Separate from tenant config.
 * Uses shared MarketplaceSettings from @decentraguild/core; extends with tenantSlug/tenantId and API-only collection fields.
 */

import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  MarketplaceSettings,
  MarketplaceGroupPath,
  MarketplaceCollectionMint,
  MarketplaceCurrencyMint,
} from '@decentraguild/core'
import { isValidTenantSlug } from '../validate-slug.js'

export type { MarketplaceGroupPath }

/** API-only fields added to collection mints (enrichment from scope/metadata). */
export interface MarketplaceCollectionMintEnriched extends MarketplaceCollectionMint {
  collectionSize?: number
  uniqueTraitCount?: number
  traitTypes?: string[]
}

/** Marketplace config: core settings plus tenant identity and enriched collection mints. */
export interface MarketplaceConfig extends Omit<MarketplaceSettings, 'collectionMints'> {
  tenantSlug: string
  tenantId?: string
  collectionMints: MarketplaceCollectionMintEnriched[]
}

/** Alias for API code that references currencyMints entries. */
export type CurrencyMint = MarketplaceCurrencyMint

const DEFAULT_MARKETPLACE_CONFIG_PATH = 'configs/marketplace'

function resolveMarketplaceConfigDir(): string | null {
  const envPath = process.env.MARKETPLACE_CONFIG_PATH
  if (envPath && typeof envPath === 'string') {
    return path.resolve(envPath)
  }
  const cwd = process.cwd()
  const fromCwd = path.join(cwd, DEFAULT_MARKETPLACE_CONFIG_PATH)
  if (existsSync(fromCwd)) return fromCwd
  const monorepoFallback = path.join(cwd, '..', '..', 'configs', 'marketplace')
  if (existsSync(monorepoFallback)) return monorepoFallback
  return fromCwd
}

export function getMarketplaceConfigDir(): string | null {
  return resolveMarketplaceConfigDir()
}

export async function loadMarketplaceBySlug(slug: string): Promise<MarketplaceConfig | null> {
  if (!isValidTenantSlug(slug)) return null
  const dir = getMarketplaceConfigDir()
  if (!dir) return null
  const filePath = path.join(dir, `${slug}.json`)
  try {
    const raw = await readFile(filePath, 'utf-8')
    const config = JSON.parse(raw) as MarketplaceConfig
    if (!config.tenantSlug || !Array.isArray(config.collectionMints) || !Array.isArray(config.currencyMints)) {
      return null
    }
    if (!Array.isArray(config.splAssetMints)) config.splAssetMints = []
    return config
  } catch {
    return null
  }
}

export async function writeMarketplaceBySlug(slug: string, config: MarketplaceConfig): Promise<void> {
  if (!isValidTenantSlug(slug)) throw new Error('Invalid tenant slug')
  const dir = getMarketplaceConfigDir()
  if (!dir) throw new Error('MARKETPLACE_CONFIG_PATH not set')
  const filePath = path.join(dir, `${slug}.json`)
  const payload = JSON.stringify(config, null, 2)
  await writeFile(filePath, payload, 'utf-8')
}

export async function listMarketplaceSlugs(): Promise<string[]> {
  const dir = getMarketplaceConfigDir()
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
