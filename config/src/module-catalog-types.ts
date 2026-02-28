/**
 * Module catalog types.
 * Single source of truth for module metadata; maps cleanly to a future DB table.
 */

import type { PricingModel } from '@decentraguild/billing'

export type ModuleCatalogStatus =
  | 'available'
  | 'coming_soon'
  | 'development'
  | 'deprecated'
  | 'off'

/** Addon of a parent module (e.g. slug is an addon of admin). Has its own pricing; can be deactivated without deactivating the parent. */
export interface ModuleCatalogAddon {
  id: string
  name: string
  shortDescription?: string
  pricing: PricingModel
}

export interface ModuleCatalogEntry {
  id: string
  status: ModuleCatalogStatus
  name: string
  icon: string
  image: string | null
  shortDescription: string
  longDescription: string
  keyInfo: string[]
  routePath: string
  order: number
  pricing: PricingModel | null
  /** Addons (e.g. slug). Billed separately; deactivating addon does not deactivate parent. */
  addons?: Record<string, ModuleCatalogAddon>
}

/** Statuses where the module code exists and can appear in tenant nav. */
export const NAVIGABLE_STATUSES: ReadonlySet<ModuleCatalogStatus> = new Set([
  'available',
  'development',
  'deprecated',
])

export function isModuleNavigable(status: ModuleCatalogStatus): boolean {
  return NAVIGABLE_STATUSES.has(status)
}
