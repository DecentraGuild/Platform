/** Browser-safe exports: types + resolver. No Node.js APIs. */
export type {
  TenantConfig,
  TenantTheme,
  TenantThemeColors,
  TenantBranding,
  TenantModuleEntry,
  TenantModulesMap,
  ModuleState,
} from './types.js'
export { isModuleVisibleToMembers, isModuleVisibleInAdmin, getModuleState } from './types.js'
export { getTenantSlugFromHost } from './resolver.js'
