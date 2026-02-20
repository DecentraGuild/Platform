/**
 * Theme store - applies tenant theme to document via CSS variables.
 * Plain Pinia, no Nuxt dependency.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TenantTheme, TenantBranding } from '@decentraguild/core'
import { DEFAULT_TENANT_THEME } from '../theme/defaults'

export function mergeTheme(base: TenantTheme, override: Partial<TenantTheme>): TenantTheme {
  const colors: NonNullable<TenantTheme['colors']> = {
    primary: { ...base.colors?.primary, ...override.colors?.primary, main: (override.colors?.primary?.main ?? base.colors?.primary?.main ?? '#00951a') as string },
    secondary: { ...base.colors?.secondary, ...override.colors?.secondary, main: (override.colors?.secondary?.main ?? base.colors?.secondary?.main ?? '#cf0000') as string },
    accent: { ...base.colors?.accent, ...override.colors?.accent, main: (override.colors?.accent?.main ?? base.colors?.accent?.main ?? '#8b5cf6') as string },
    background: { ...base.colors?.background, ...override.colors?.background },
    text: { ...base.colors?.text, ...override.colors?.text },
    border: { ...base.colors?.border, ...override.colors?.border },
    status: { ...base.colors?.status, ...override.colors?.status },
    trade: { ...base.colors?.trade, ...override.colors?.trade },
    window: { ...base.colors?.window, ...override.colors?.window },
  }
  return {
    ...base,
    ...override,
    colors,
    fontSize: { ...base.fontSize, ...override.fontSize },
    spacing: { ...base.spacing, ...override.spacing },
    borderRadius: { ...base.borderRadius, ...override.borderRadius },
    borderWidth: { ...base.borderWidth, ...override.borderWidth },
    shadows: { ...base.shadows, ...override.shadows },
    gradients: { ...base.gradients, ...override.gradients },
    fonts: { ...base.fonts, ...override.fonts },
  }
}

export function themeToCssVars(theme: TenantTheme): Record<string, string> {
  const colors = theme.colors ?? {}
  const fontSize = theme.fontSize ?? {}
  const spacing = theme.spacing ?? {}
  const borderRadius = theme.borderRadius ?? {}
  const borderWidth = theme.borderWidth ?? {}
  const shadows = theme.shadows ?? {}
  const gradients = theme.gradients ?? {}

  return {
    '--theme-primary': colors.primary?.main ?? '',
    '--theme-primary-hover': colors.primary?.hover ?? '',
    '--theme-primary-light': colors.primary?.light ?? '',
    '--theme-primary-dark': colors.primary?.dark ?? '',
    '--theme-secondary': colors.secondary?.main ?? '',
    '--theme-secondary-hover': colors.secondary?.hover ?? '',
    '--theme-secondary-light': colors.secondary?.light ?? '',
    '--theme-secondary-dark': colors.secondary?.dark ?? '',
    '--theme-accent': colors.accent?.main ?? '',
    '--theme-accent-hover': colors.accent?.hover ?? '',
    '--theme-bg-primary': colors.background?.primary ?? '',
    '--theme-bg-secondary': colors.background?.secondary ?? '',
    '--theme-bg-card': colors.background?.card ?? '',
    '--theme-text-primary': colors.text?.primary ?? '',
    '--theme-text-secondary': colors.text?.secondary ?? '',
    '--theme-text-muted': colors.text?.muted ?? '',
    '--theme-border': colors.border?.default ?? '',
    '--theme-border-light': colors.border?.light ?? '',
    '--theme-success': colors.status?.success ?? '',
    '--theme-error': colors.status?.error ?? '',
    '--theme-warning': colors.status?.warning ?? '',
    '--theme-info': colors.status?.info ?? '',
    '--theme-trade-buy': colors.trade?.buy ?? '',
    '--theme-trade-buy-hover': colors.trade?.buyHover ?? '',
    '--theme-trade-buy-light': colors.trade?.buyLight ?? '',
    '--theme-trade-sell': colors.trade?.sell ?? '',
    '--theme-trade-sell-hover': colors.trade?.sellHover ?? '',
    '--theme-trade-sell-light': colors.trade?.sellLight ?? '',
    '--theme-trade-trade': colors.trade?.trade ?? '',
    '--theme-trade-trade-hover': colors.trade?.tradeHover ?? '',
    '--theme-trade-trade-light': colors.trade?.tradeLight ?? '',
    '--theme-trade-swap': colors.trade?.swap ?? '',
    '--theme-trade-swap-hover': colors.trade?.swapHover ?? '',
    '--theme-trade-swap-light': colors.trade?.swapLight ?? '',
    '--theme-window-bg': colors.window?.background ?? '',
    '--theme-window-border': colors.window?.border ?? '',
    '--theme-window-header': colors.window?.header ?? '',
    '--theme-font-xs': fontSize.xs ?? '',
    '--theme-font-sm': fontSize.sm ?? '',
    '--theme-font-base': fontSize.base ?? '',
    '--theme-font-lg': fontSize.lg ?? '',
    '--theme-font-xl': fontSize.xl ?? '',
    '--theme-font-2xl': fontSize['2xl'] ?? '',
    '--theme-font-3xl': fontSize['3xl'] ?? '',
    '--theme-font-4xl': fontSize['4xl'] ?? '',
    '--theme-font-5xl': fontSize['5xl'] ?? '',
    '--theme-space-xs': spacing.xs ?? '',
    '--theme-space-sm': spacing.sm ?? '',
    '--theme-space-md': spacing.md ?? '',
    '--theme-space-lg': spacing.lg ?? '',
    '--theme-space-xl': spacing.xl ?? '',
    '--theme-space-2xl': spacing['2xl'] ?? '',
    '--theme-radius-sm': borderRadius.sm ?? '',
    '--theme-radius-md': borderRadius.md ?? '',
    '--theme-radius-lg': borderRadius.lg ?? '',
    '--theme-radius-xl': borderRadius.xl ?? '',
    '--theme-radius-full': borderRadius.full ?? '',
    '--theme-border-thin': borderWidth.thin ?? '',
    '--theme-border-medium': borderWidth.medium ?? '',
    '--theme-border-thick': borderWidth.thick ?? '',
    '--theme-shadow-glow': shadows.glow ?? '',
    '--theme-shadow-glow-hover': shadows.glowHover ?? '',
    '--theme-shadow-card': shadows.card ?? '',
    '--theme-gradient-primary': gradients.primary ?? '',
    '--theme-gradient-secondary': gradients.secondary ?? '',
    '--theme-gradient-accent': gradients.accent ?? '',
  }
}

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<TenantTheme>(DEFAULT_TENANT_THEME)
  const branding = ref<{ logo?: string; name?: string; shortName?: string }>({})

  const cssVars = computed(() => themeToCssVars(currentTheme.value))

  function loadTheme(theme: Partial<TenantTheme>, brandingOverride?: Partial<TenantBranding>) {
    const merged = mergeTheme(DEFAULT_TENANT_THEME, theme ?? {})
    currentTheme.value = merged
    if (brandingOverride) {
      branding.value = {
        logo: brandingOverride.logo,
        name: brandingOverride.name,
        shortName: brandingOverride.shortName,
      }
    }
    applyThemeToDocument()
  }

  function applyThemeToDocument() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const vars = themeToCssVars(currentTheme.value)
    for (const [prop, value] of Object.entries(vars)) {
      if (value) root.style.setProperty(prop, value)
    }
  }

  return {
    currentTheme,
    branding,
    cssVars,
    loadTheme,
    applyThemeToDocument,
  }
})
