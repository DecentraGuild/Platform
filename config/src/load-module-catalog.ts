import type { ModuleCatalogEntry, ModuleCatalogAddon } from './module-catalog-types.js'

import admin from '../module-catalog/admin.json'
import marketplace from '../module-catalog/marketplace.json'
import discord from '../module-catalog/discord.json'
import whitelist from '../module-catalog/whitelist.json'
import raffles from '../module-catalog/raffles.json'

const entries: ModuleCatalogEntry[] = [
  admin as ModuleCatalogEntry,
  marketplace as ModuleCatalogEntry,
  discord as ModuleCatalogEntry,
  whitelist as ModuleCatalogEntry,
  raffles as ModuleCatalogEntry,
]

const catalog: Record<string, ModuleCatalogEntry> = Object.fromEntries(
  entries.map((entry) => [entry.id, entry]),
)

/** Build synthetic catalog entry for an addon (e.g. slug from admin). */
function addonToCatalogEntry(addon: ModuleCatalogAddon, parent: ModuleCatalogEntry): ModuleCatalogEntry {
  return {
    id: addon.id,
    status: parent.status,
    name: addon.name,
    icon: parent.icon,
    image: null,
    shortDescription: addon.shortDescription ?? addon.name,
    longDescription: addon.shortDescription ?? addon.name,
    keyInfo: [],
    routePath: parent.routePath,
    order: parent.order,
    pricing: addon.pricing,
    addons: undefined,
  }
}

/** All module catalog entries keyed by module id. Includes top-level modules only; addons resolved via getModuleCatalogEntry. */
export function getModuleCatalog(): Record<string, ModuleCatalogEntry> {
  return catalog
}

/** Single module catalog entry by id, or undefined if not found. Resolves addons (e.g. slug from admin). */
export function getModuleCatalogEntry(id: string): ModuleCatalogEntry | undefined {
  const direct = catalog[id]
  if (direct) return direct
  const adminEntry = catalog['admin'] as ModuleCatalogEntry & { addons?: Record<string, ModuleCatalogAddon> }
  const addon = adminEntry?.addons?.[id]
  if (addon) return addonToCatalogEntry(addon, adminEntry)
  return undefined
}

/** All catalog entries sorted by order. */
export function getModuleCatalogList(): ModuleCatalogEntry[] {
  return [...entries].sort((a, b) => a.order - b.order)
}

/** Billing period values accepted by the pricing engine and API. */
export const VALID_BILLING_PERIODS: ReadonlySet<string> = new Set(['monthly', 'yearly'])

/** Display name for a module (e.g. for invoices). Uses catalog name; falls back to module id. */
export function getModuleDisplayName(moduleId: string): string {
  const entry = getModuleCatalogEntry(moduleId)
  return entry?.name ?? moduleId
}
