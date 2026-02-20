export type {
  TenantConfig,
  TenantTheme,
  TenantThemeColors,
  TenantBranding,
  TenantModuleEntry,
  TenantModulesMap,
} from './types.js'
export { normalizeModules } from './types.js'
export { TENANT_DOMAIN, getTenantSlugFromHost } from './resolver.js'
export { loadTenantConfig } from './loader.js'
