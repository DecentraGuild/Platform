/**
 * Resolves tenant slug from host or query params.
 * For localhost, use ?tenant=slug. For production, use subdomain.decentraguild.com.
 */

export function getTenantSlugFromHost(
  host: string,
  searchParams?: URLSearchParams
): string | null {
  if (!host) return null

  const hostLower = host.toLowerCase()

  if (hostLower === 'localhost' || hostLower.startsWith('127.0.0.1') || hostLower.startsWith('localhost:')) {
    if (searchParams) {
      const slug = searchParams.get('tenant')
      return slug && slug.trim() ? slug.trim() : null
    }
    return null
  }

  if (hostLower.endsWith('.decentraguild.com')) {
    const subdomain = hostLower.replace(/\.decentraguild\.com$/, '')
    const slug = subdomain === 'www' || subdomain === '' ? null : subdomain
    return slug || null
  }

  return null
}
