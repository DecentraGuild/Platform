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

/** Tenant ID format for id-only orgs: dg_ + 8 alphanumeric. Subdomain-safe. */
const ID_REGEX = /^dg_[a-z0-9]{8}$/

export function isValidTenantId(id: string): boolean {
  if (typeof id !== 'string') return false
  const s = id.trim().toLowerCase()
  return s.length > 0 && ID_REGEX.test(s)
}

/** Returns true if string is a valid tenant identifier (slug or id). */
export function isValidTenantIdentifier(idOrSlug: string): boolean {
  return isValidTenantSlug(idOrSlug) || isValidTenantId(idOrSlug)
}

/** Returns normalized identifier (slug or id) if valid; otherwise null. */
export function normalizeTenantIdentifier(idOrSlug: string): string | null {
  const s = typeof idOrSlug === 'string' ? idOrSlug.trim() : ''
  if (!s) return null
  if (isValidTenantId(s)) return s.toLowerCase()
  return normalizeTenantSlug(s)
}

/** Returns normalized slug (trimmed, lowercase) if valid; otherwise null. */
export function normalizeTenantSlug(slug: string): string | null {
  if (typeof slug !== 'string') return null
  const s = slug.trim().toLowerCase()
  if (s.length === 0 || s.length > SLUG_MAX_LEN) return null
  if (s.includes('..')) return null
  return SLUG_REGEX.test(s) ? s : null
}
