/** Browser-safe exports: types + resolver. No Node.js APIs. */
export type {
  TenantConfig,
  TenantTheme,
  TenantThemeColors,
  TenantBranding,
  TenantModuleRef,
} from './types.js'
export { getTenantSlugFromHost } from './resolver.js'
