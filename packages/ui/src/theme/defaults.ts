/**
 * Default theme tokens aligned with C2C theme.js defaultTheme.
 * Used as base for tenant theme merging.
 */

import type { TenantTheme } from '@decentraguild/core'

export const DEFAULT_TENANT_THEME: TenantTheme = {
  colors: {
    primary: {
      main: '#00951a',
      hover: '#00b820',
      light: '#00cc22',
      dark: '#007a14',
    },
    secondary: {
      main: '#cf0000',
      hover: '#b30000',
      light: '#ff3333',
      dark: '#990000',
    },
    accent: {
      main: '#8b5cf6',
      hover: '#7c3aed',
    },
    background: {
      primary: '#0a0a0f',
      secondary: '#141420',
      card: '#1a1a2e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a0a0b3',
      muted: '#6b6b80',
    },
    border: {
      default: '#2a2a3e',
      light: '#3a3a4e',
    },
    status: {
      success: '#00951a',
      error: '#cf0000',
      warning: '#ff6b35',
      info: '#00d4ff',
    },
    trade: {
      buy: '#00ff00',
      buyHover: '#00cc00',
      buyLight: '#33ff33',
      sell: '#ff0000',
      sellHover: '#cc0000',
      sellLight: '#ff3333',
      trade: '#ffaa00',
      tradeHover: '#cc8800',
      tradeLight: '#ffbb33',
      swap: '#6366f1',
      swapHover: '#4f46e5',
      swapLight: '#818cf8',
    },
    window: {
      background: '#1a1a2e',
      border: '#2a2a3e',
      header: '#141420',
    },
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    full: '9999px',
  },
  borderWidth: {
    thin: '1px',
    medium: '2px',
    thick: '4px',
  },
  shadows: {
    glow: '0 0 20px rgba(0, 149, 26, 0.3)',
    glowHover: '0 0 40px rgba(0, 149, 26, 0.6)',
    card: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #00951a 0%, #00cc22 50%, #007a14 100%)',
    secondary: 'linear-gradient(135deg, #ff6b35 0%, #f59e0b 100%)',
    accent: 'linear-gradient(135deg, #00951a 0%, #cf0000 100%)',
  },
  fonts: {
    primary: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },
}
