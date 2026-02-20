/**
 * Helpers for admin theme settings: color derivation and radius presets.
 */

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const s = String(hex).trim().replace(/^#/, '')
  if (s.length === 6 && /^[0-9a-fA-F]{6}$/.test(s)) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    }
  }
  if (s.length === 3 && /^[0-9a-fA-F]{3}$/.test(s)) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
    }
  }
  return null
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(255, n)))
  return '#' + [r, g, b].map(clamp).map((n) => n.toString(16).padStart(2, '0')).join('')
}

/** Lighten a hex color by a percentage (0–1). */
export function lightenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const { r, g, b } = rgb
  const t = 255
  return toHex(
    r + (t - r) * amount,
    g + (t - g) * amount,
    b + (t - b) * amount
  )
}

/** Darken a hex color by a percentage (0–1). */
export function darkenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const { r, g, b } = rgb
  return toHex(
    r * (1 - amount),
    g * (1 - amount),
    b * (1 - amount)
  )
}

/** Mix two hex colors. amount 0 = a, 1 = b. */
export function mixHex(a: string, b: string, amount: number): string {
  const ra = parseHex(a)
  const rb = parseHex(b)
  if (!ra || !rb) return amount >= 0.5 ? b : a
  return toHex(
    ra.r + (rb.r - ra.r) * amount,
    ra.g + (rb.g - ra.g) * amount,
    ra.b + (rb.b - ra.b) * amount
  )
}

/** Border radius presets: 0 = sharp, 4 = round. */
export const BORDER_RADIUS_PRESETS: Array<Record<string, string>> = [
  { sm: '0', md: '0', lg: '0', xl: '0', full: '0' },
  { sm: '0.2rem', md: '0.3rem', lg: '0.4rem', xl: '0.5rem', full: '9999px' },
  { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' },
  { sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.25rem', full: '9999px' },
  { sm: '0.75rem', md: '1rem', lg: '1.25rem', xl: '1.5rem', full: '9999px' },
]

export function getRadiusLevelFromTheme(theme: { borderRadius?: Record<string, string> }): number {
  const md = theme.borderRadius?.md ?? ''
  for (let i = 0; i < BORDER_RADIUS_PRESETS.length; i++) {
    if (BORDER_RADIUS_PRESETS[i].md === md) return i
  }
  return 2
}

/** Parse rem string to number (e.g. "1rem" -> 1). */
export function parseRem(value: string): number {
  const s = String(value).trim()
  const m = s.match(/^([\d.]+)\s*rem$/)
  if (m) return Number(m[1])
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 1
}
