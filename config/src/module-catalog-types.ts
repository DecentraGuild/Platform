/**
 * Module catalog types.
 * Single source of truth for module metadata; maps cleanly to a future DB table.
 */

export type ModuleCatalogStatus =
  | 'available'
  | 'coming_soon'
  | 'development'
  | 'deprecated'
  | 'off'

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
  pricing: null
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
