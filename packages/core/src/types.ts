/**
 * Tenant and theme types for DecentraGuild.
 * Aligned with C2C example-theme.json and skull-bones.json structure.
 */

export interface TenantModuleRef {
  id: string
  enabled: boolean
  configRef?: string
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
  modules: TenantModuleRef[]
  admins: string[]
  treasury?: string
  createdAt?: string
  updatedAt?: string
}
