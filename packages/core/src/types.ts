/**
 * Tenant and theme types for DecentraGuild.
 * Aligned with C2C example-theme.json and skull-bones.json structure.
 */

/** Lifecycle state for a module. */
export type ModuleState = 'off' | 'staging' | 'active' | 'deactivating'

/** Per-module entry: state, optional dates for auto transition, optional settings. */
export interface TenantModuleEntry {
  state: ModuleState
  /** ISO datetime: when to transition active -> deactivating. Set by admin or Deploy (e.g. for testing). */
  deactivatedate?: string | null
  /** ISO datetime: when to transition deactivating -> off. Set by cron when entering deactivating. */
  deactivatingUntil?: string | null
  settingsjson?: Record<string, unknown>
}

/** Modules keyed by module id. */
export type TenantModulesMap = Record<string, TenantModuleEntry>

const VALID_STATES: ModuleState[] = ['off', 'staging', 'active', 'deactivating']

function toState(value: unknown): ModuleState {
  if (typeof value === 'string' && VALID_STATES.includes(value as ModuleState)) return value as ModuleState
  return 'off'
}

/** Normalize raw modules to TenantModulesMap. Accepts object keyed by id or legacy array. Default state 'off'. */
export function normalizeModules(
  raw:
    | TenantModulesMap
    | Array<{ id: string; enabled?: boolean; state?: ModuleState }>
    | Record<string, { state?: ModuleState; active?: boolean; deactivatedate?: string | null; deactivatingUntil?: string | null; settingsjson?: Record<string, unknown> }>
    | null
    | undefined
): TenantModulesMap {
  if (raw == null) return {}
  if (Array.isArray(raw)) {
    const map: TenantModulesMap = {}
    for (const m of raw) {
      const state = m.state ?? ((m as { enabled?: boolean }).enabled !== false ? 'active' : 'off')
      map[m.id] = {
        state: toState(state),
        deactivatedate: null,
        deactivatingUntil: null,
        settingsjson: {},
      }
    }
    return map
  }
  const obj = raw as Record<string, unknown>
  const result: TenantModulesMap = {}
  for (const id of Object.keys(obj)) {
    const entry = obj[id] as Record<string, unknown> | undefined
    if (!entry || typeof entry !== 'object') continue
    const legacyActive = entry.active === true
    const state = toState(entry.state ?? (legacyActive ? 'active' : 'off'))
    result[id] = {
      state,
      deactivatedate: typeof entry.deactivatedate === 'string' ? entry.deactivatedate : null,
      deactivatingUntil: typeof entry.deactivatingUntil === 'string' ? entry.deactivatingUntil : null,
      settingsjson: (entry.settingsjson as Record<string, unknown>) ?? {},
    }
  }
  return result
}

/** True if members see the module in nav and can use it (active or deactivating). */
export function isModuleVisibleToMembers(state: ModuleState): boolean {
  return state === 'active' || state === 'deactivating'
}

/** True if admin sees the module in Admin (staging, active, or deactivating). */
export function isModuleVisibleInAdmin(state: ModuleState): boolean {
  return state === 'staging' || state === 'active' || state === 'deactivating'
}

/** Get module state from entry; default 'off'. */
export function getModuleState(entry: TenantModuleEntry | undefined): ModuleState {
  return entry?.state ? toState(entry.state) : 'off'
}

export interface TenantThemeColors {
  primary?: { main: string; hover?: string; light?: string; dark?: string }
  secondary?: { main: string; hover?: string; light?: string; dark?: string }
  accent?: { main: string; hover?: string }
  background?: { primary?: string; secondary?: string; card?: string }
  text?: { primary?: string; secondary?: string; muted?: string }
  border?: { default?: string; light?: string }
  status?: { success?: string; error?: string; warning?: string; info?: string }
  trade?: {
    buy?: string
    buyHover?: string
    buyLight?: string
    sell?: string
    sellHover?: string
    sellLight?: string
    trade?: string
    tradeHover?: string
    tradeLight?: string
    swap?: string
    swapHover?: string
    swapLight?: string
  }
  window?: { background?: string; border?: string; header?: string }
}

export interface TenantTheme {
  colors?: TenantThemeColors
  fontSize?: Record<string, string>
  spacing?: Record<string, string>
  borderRadius?: Record<string, string>
  borderWidth?: Record<string, string>
  shadows?: Record<string, string>
  gradients?: Record<string, string>
  fonts?: {
    primary?: string[]
    mono?: string[]
  }
}

export interface TenantBranding {
  logo?: string
  name?: string
  shortName?: string
  theme?: TenantTheme
  themeRef?: string
}

export interface TenantConfig {
  id: string
  slug: string
  name: string
  description?: string
  branding: TenantBranding
  /** Modules keyed by id. Use normalizeModules() when reading from JSON that may be legacy array. */
  modules: TenantModulesMap
  admins: string[]
  treasury?: string
  createdAt?: string
  updatedAt?: string
}

/** 0..3 group labels for flexible tree levels under Type. Shared by API and tenant app. */
export type MarketplaceGroupPath = string[]

export interface MarketplaceCollectionMint {
  mint: string
  name?: string
  image?: string
  sellerFeeBasisPoints?: number
  groupPath?: MarketplaceGroupPath
}

export interface MarketplaceCurrencyMint {
  mint: string
  name: string
  symbol: string
  image?: string
  decimals?: number
  sellerFeeBasisPoints?: number
  groupPath?: MarketplaceGroupPath
}

export interface MarketplaceSplAsset {
  mint: string
  name?: string
  symbol?: string
  image?: string
  decimals?: number
  sellerFeeBasisPoints?: number
  groupPath?: MarketplaceGroupPath
}

export interface MarketplaceWhitelistSettings {
  programId: string
  account: string
}

export interface MarketplaceShopFee {
  wallet: string
  makerFlatFee: number
  takerFlatFee: number
  makerPercentFee: number
  takerPercentFee: number
}

/** Marketplace settings shape shared by API and tenant app. API extends with tenantSlug/tenantId. */
export interface MarketplaceSettings {
  collectionMints: MarketplaceCollectionMint[]
  splAssetMints?: MarketplaceSplAsset[]
  currencyMints: MarketplaceCurrencyMint[]
  whitelist?: MarketplaceWhitelistSettings
  shopFee: MarketplaceShopFee
}
