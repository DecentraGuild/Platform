import type { ModuleCatalogEntry } from './module-catalog-types.js'

import admin from '../module-catalog/admin.json'
import marketplace from '../module-catalog/marketplace.json'
import discord from '../module-catalog/discord.json'
import raffles from '../module-catalog/raffles.json'
import whitelist from '../module-catalog/whitelist.json'
import minting from '../module-catalog/minting.json'

const entries: ModuleCatalogEntry[] = [
  admin,
  marketplace,
  discord,
  raffles,
  whitelist,
  minting,
] as ModuleCatalogEntry[]

const catalog: Record<string, ModuleCatalogEntry> = Object.fromEntries(
  entries.map((entry) => [entry.id, entry]),
)

/** All module catalog entries keyed by module id. */
export function getModuleCatalog(): Record<string, ModuleCatalogEntry> {
  return catalog
}

/** Single module catalog entry by id, or undefined if not found. */
export function getModuleCatalogEntry(id: string): ModuleCatalogEntry | undefined {
  return catalog[id]
}

/** All catalog entries sorted by order. */
export function getModuleCatalogList(): ModuleCatalogEntry[] {
  return [...entries].sort((a, b) => a.order - b.order)
}
