/**
 * Resolves tenant slug from host or query params.
 * Platform: dguild.org (main). Tenant shell: subdomain.dguild.org (e.g. dapp.dguild.org, skull.dguild.org).
 * For localhost, use ?tenant=slug. ?tenant= overrides host when present.
 */

export const TENANT_DOMAIN = '.dguild.org'

function getSlugFromHost(host: string): string | null {
  const hostLower = host.toLowerCase()
  if (!hostLower.endsWith(TENANT_DOMAIN)) return null
  const subdomain = hostLower.slice(0, -TENANT_DOMAIN.length).replace(/\.$/, '')
  if (subdomain === 'www' || subdomain === '') return null
  return subdomain
}

export function getTenantSlugFromHost(
  host: string,
  searchParams?: URLSearchParams
): string | null {
  if (!host) return null

  const hostLower = host.toLowerCase()

  if (searchParams) {
    const querySlug = searchParams.get('tenant')
    if (querySlug && querySlug.trim()) return querySlug.trim()
  }

  if (hostLower === 'localhost' || hostLower.startsWith('127.0.0.1') || hostLower.startsWith('localhost:')) {
    return null
  }

  return getSlugFromHost(host)
}
