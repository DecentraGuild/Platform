import type { FastifyInstance } from 'fastify'
import { getTenantSlugFromHost, isModuleVisibleToMembers, getModuleState } from '@decentraguild/core'
import type { TenantConfigDiagnostic } from '../config/registry.js'
import { normalizeTenantIdentifier } from '../validate-slug.js'
import { loadTenantBySlugDiagnostic } from '../config/registry.js'
import { resolveTenant } from '../db/tenant.js'
import { resolveMarketplaceEnriched } from '../marketplace/enrich-config.js'
import { getWalletFromRequest } from './auth.js'
import { apiError, ErrorCode } from '../api-errors.js'

const CACHE_MAX_AGE_SECONDS = 60

export async function registerTenantContextRoutes(app: FastifyInstance) {
  app.get('/api/v1/tenant-context', async (request, reply) => {
    const { searchParams } = new URL(request.url, 'http://localhost')
    const slugParam = searchParams.get('slug')
    const host = request.headers.host ?? ''
    const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true'

    // In production, use Host only (no ?slug=) to avoid enumerating tenant configs by slug.
    const rawSlug =
      process.env.NODE_ENV === 'production'
        ? getTenantSlugFromHost(host) ?? null
        : (slugParam ?? getTenantSlugFromHost(host, searchParams))
    const slug = rawSlug ? normalizeTenantIdentifier(rawSlug) : null

    if (!slug) {
      return reply.status(404).send(apiError(rawSlug ? 'Invalid tenant identifier' : 'Tenant identifier required', ErrorCode.INVALID_SLUG))
    }

    const tenant = await resolveTenant(slug)
    if (!tenant) {
      const body = apiError('Tenant not found', ErrorCode.TENANT_NOT_FOUND)
      if (debug && process.env.NODE_ENV !== 'production') {
        (body as { diagnostic?: TenantConfigDiagnostic }).diagnostic = await loadTenantBySlugDiagnostic(slug)
      }
      return reply.status(404).send(body)
    }

    const wallet = await getWalletFromRequest(request)
    const isAdmin = wallet && Array.isArray(tenant.admins) && tenant.admins.includes(wallet)
    if (!isAdmin) {
      reply.header('Cache-Control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`)
    }

    let marketplaceSettings = null
    if (tenant.id && isModuleVisibleToMembers(getModuleState(tenant.modules?.marketplace))) {
      marketplaceSettings = await resolveMarketplaceEnriched(tenant.id)
    }

    return { tenant, marketplaceSettings: marketplaceSettings ?? undefined }
  })
}
