/**
 * Tenant slug validation for safe use in file paths and DB.
 * Prevents path traversal and allows only subdomain-safe characters.
 */
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
const SLUG_MAX_LEN = 64

export function isValidTenantSlug(slug: string): boolean {
  if (typeof slug !== 'string') return false
  const s = slug.trim().toLowerCase()
  if (s.length === 0 || s.length > SLUG_MAX_LEN) return false
  if (s.includes('..')) return false
  return SLUG_REGEX.test(s)
}

/** Returns normalized slug (trimmed, lowercase) if valid; otherwise null. */
export function normalizeTenantSlug(slug: string): string | null {
  if (typeof slug !== 'string') return null
  const s = slug.trim().toLowerCase()
  if (s.length === 0 || s.length > SLUG_MAX_LEN) return null
  if (s.includes('..')) return null
  return SLUG_REGEX.test(s) ? s : null
}
