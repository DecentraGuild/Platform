import type { ModuleState } from '@decentraguild/core'
import { isModuleVisibleInAdmin, getModuleState } from '@decentraguild/core'
import { getModuleCatalogList, isModuleNavigable } from '@decentraguild/config'
import type { ModuleCatalogEntry } from '@decentraguild/config'

export interface ModuleNavEntry {
  path: string
  label: string
  icon: string
}

const catalog = getModuleCatalogList()

/** Module id to route, label, and nav icon. Derived from the module catalog. */
export const MODULE_NAV: Record<string, ModuleNavEntry> = Object.fromEntries(
  catalog.map((m: ModuleCatalogEntry) => [
    m.id,
    { path: m.routePath, label: m.name, icon: m.icon },
  ]),
)

/** Modules whose code exists and can appear in tenant nav (status: available, development, deprecated). */
export const IMPLEMENTED_MODULES = new Set(
  catalog.filter((m: ModuleCatalogEntry) => isModuleNavigable(m.status)).map((m) => m.id),
)

/** Sub-nav (topbar tabs) per module. Key = module id. */
export interface ModuleSubnavTab {
  id: string
  label: string
  path?: string
}

export const MODULE_SUBNAV: Record<string, ModuleSubnavTab[]> = {
  admin: [
    { id: 'general', label: 'General' },
    { id: 'modules', label: 'Modules' },
    { id: 'theming', label: 'Theming' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'discord', label: 'Discord' },
    { id: 'billing', label: 'Billing' },
  ],
  marketplace: [
    { id: 'browse', label: 'Browse' },
    { id: 'open-trades', label: 'My Trades' },
  ],
  discord: [],
}

interface TenantModule {
  state?: ModuleState
}

/** Resolve module sub-nav tabs for a route path (e.g. /admin -> admin tabs).
 * When tenant is provided and path is admin, marketplace/discord tabs shown when visible in Admin.
 * Prefer modules that have subnav (slug and admin both use /admin; slug has no tabs). */
export function getModuleSubnavForPath(
  path: string,
  tenant?: { modules?: Record<string, TenantModule> } | null,
): ModuleSubnavTab[] | null {
  const moduleId = Object.entries(MODULE_NAV)
    .filter(([, entry]) => path === entry.path || path.startsWith(entry.path + '/'))
    .find(([id]) => MODULE_SUBNAV[id])?.[0]
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
