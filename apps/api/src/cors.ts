/**
 * Dynamic CORS: explicit CORS_ORIGIN list plus any tenant subdomain (https://<slug>.<tenant_domain>).
 * New tenants need no CORS_ORIGIN update or redeploy.
 */

import { TENANT_DOMAIN } from '@decentraguild/core'

function getTenantDomain(): string {
  const env = process.env.CORS_TENANT_DOMAIN?.trim()
  if (env) return env.startsWith('.') ? env : `.${env}`
  return TENANT_DOMAIN
}

function isTenantSubdomainOrigin(origin: string, tenantDomain: string): boolean {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (!host.endsWith(tenantDomain)) return false
    const subdomain = host.slice(0, -tenantDomain.length).replace(/\.$/, '')
    return subdomain !== '' && subdomain !== 'www'
  } catch {
    return false
  }
}

function parseExplicitOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002'
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

/** Allow any localhost/127.0.0.1 origin in development (avoids CORS issues with varying ports). */
function isLocalhostOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    const host = u.hostname.toLowerCase()
    return (host === 'localhost' || host === '127.0.0.1') && (u.protocol === 'http:' || u.protocol === 'https:')
  } catch {
    return false
  }
}

/**
 * Returns the dynamic origin function for @fastify/cors.
 * Allows: (1) origins in CORS_ORIGIN, (2) https://<slug>.<CORS_TENANT_DOMAIN> (default .dguild.org).
 */
export function buildCorsOrigin(): (
  origin: string | undefined,
  cb: (err: Error | null, allow: boolean) => void
) => void {
  const tenantDomain = getTenantDomain()
  const explicitSet = new Set(parseExplicitOrigins())

  return (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    if (!origin || typeof origin !== 'string') {
      cb(null, false)
      return
    }
    const normalized = origin.trim().toLowerCase()
    if (
      explicitSet.has(normalized) ||
      isTenantSubdomainOrigin(origin, tenantDomain) ||
      (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin))
    ) {
      cb(null, true)
      return
    }
    cb(null, false)
  }
}
