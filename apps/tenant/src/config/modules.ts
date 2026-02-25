/**
 * Module id to route, label, and nav icon. Single source of truth.
 * Only implemented modules appear in nav. Icons: @iconify/vue (mdi set).
 */

export interface ModuleNavEntry {
  path: string
  label: string
  icon: string
}

export const MODULE_NAV: Record<string, ModuleNavEntry> = {
  admin: { path: '/admin', label: 'Admin', icon: 'mdi:cog' },
  marketplace: { path: '/market', label: 'Market', icon: 'mdi:store' },
  discord: { path: '/discord', label: 'Discord', icon: 'mdi:discord' },
  raffles: { path: '/raffle', label: 'Raffle', icon: 'mdi:ticket' },
  whitelist: { path: '/whitelist', label: 'Whitelist', icon: 'mdi:format-list-checks' },
  minting: { path: '/mint', label: 'Mint', icon: 'mdi:brush' },
}

/** Modules that are implemented and can be shown in nav */
export const IMPLEMENTED_MODULES = new Set(['admin', 'marketplace', 'discord'])

/** Sub-nav (topbar tabs) per module. Key = module id. */
export interface ModuleSubnavTab {
  id: string
  label: string
  /** When set, tab links to this path instead of route.path?tab=id */
  path?: string
}

export const MODULE_SUBNAV: Record<string, ModuleSubnavTab[]> = {
  admin: [
    { id: 'general', label: 'General' },
    { id: 'modules', label: 'Modules' },
    { id: 'theming', label: 'Theming' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'discord', label: 'Discord' },
  ],
  marketplace: [
    { id: 'browse', label: 'Browse' },
    { id: 'open-trades', label: 'My Trades' },
  ],
  discord: [],
}

import type { ModuleState } from '@decentraguild/core'
import { isModuleVisibleInAdmin, getModuleState } from '@decentraguild/core'

/** Tenant module shape for subnav filtering */
interface TenantModule {
  state?: ModuleState
}

/** Resolve module sub-nav tabs for a route path (e.g. /admin -> admin tabs).
 * When tenant is provided and path is admin, marketplace/discord tabs shown when visible in Admin. */
export function getModuleSubnavForPath(
  path: string,
  tenant?: { modules?: Record<string, TenantModule> } | null
): ModuleSubnavTab[] | null {
  const moduleId = Object.entries(MODULE_NAV).find(([, entry]) =>
    path === entry.path || path.startsWith(entry.path + '/')
  )?.[0]
  const tabs = (moduleId && MODULE_SUBNAV[moduleId]) ?? null
  if (!tabs || moduleId !== 'admin' || !tenant?.modules) return tabs
  const marketplaceVisible = isModuleVisibleInAdmin(getModuleState(tenant.modules.marketplace))
  const discordVisible = isModuleVisibleInAdmin(getModuleState(tenant.modules.discord))
  return tabs.filter((t) => {
    if (t.id === 'marketplace' && !marketplaceVisible) return false
    if (t.id === 'discord' && !discordVisible) return false
    return true
  })
}
