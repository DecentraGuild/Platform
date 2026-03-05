import type { FastifyInstance } from 'fastify'
import { isModuleVisibleToMembers, getModuleState, getModuleWhitelistFromTenant } from '@decentraguild/core'
import type { TenantConfigDiagnostic } from '../config/registry.js'
import { normalizeTenantIdentifier } from '../validate-slug.js'
import { loadTenantBySlugDiagnostic } from '../config/registry.js'
import { resolveTenant } from '../db/tenant.js'
import { resolveMarketplaceEnriched } from '../marketplace/enrich-config.js'
import { getRaffleSettings } from '../db/raffle.js'
import { getWalletFromRequest } from './auth.js'
import { apiError, ErrorCode } from '../api-errors.js'

const CACHE_MAX_AGE_SECONDS = 60

/**
 * Tenant-context is always called with the tenant in the request: the API has a single host
 * (api.dguild.org), so Host-based resolution does not apply. The tenant app (dapp.dguild.org or
 * tenant.dguild.org) resolves tenant from its own URL and passes ?slug= when calling this endpoint.
 */
export async function registerTenantContextRoutes(app: FastifyInstance) {
  app.get('/api/v1/tenant-context', async (request, reply) => {
    const { searchParams } = new URL(request.url, 'http://localhost')
    const slugParam = searchParams.get('slug')?.trim() || null
    const headerSlug = (request.headers['x-tenant'] as string)?.trim() || null
    const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true'

    const rawSlug = slugParam ?? headerSlug
    const slug = rawSlug ? normalizeTenantIdentifier(rawSlug) : null

    if (!slug) {
      return reply.status(404).send(apiError(rawSlug ? 'Invalid tenant identifier' : 'Tenant identifier required', ErrorCode.INVALID_SLUG))
    }

    const tenant = await resolveTenant(slug)
    if (!tenant) {
      request.log.warn({ slug, slugParam }, 'Tenant not found')
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

    const isMarketplaceVisible = tenant.id && isModuleVisibleToMembers(getModuleState(tenant.modules?.marketplace))
    const isRafflesVisible = tenant.id && isModuleVisibleToMembers(getModuleState(tenant.modules?.raffles))

    const [marketplaceSettings, raffleSettings] = await Promise.all([
      isMarketplaceVisible ? resolveMarketplaceEnriched(tenant.id) : Promise.resolve(null),
      isRafflesVisible ? getRaffleSettings(tenant.id) : Promise.resolve(null),
    ])

    const marketplaceOut = marketplaceSettings
      ? {
          ...marketplaceSettings,
          whitelist: getModuleWhitelistFromTenant(tenant, 'marketplace'),
        }
      : undefined
    const raffleOut = raffleSettings
      ? {
          ...raffleSettings,
          defaultWhitelist: (tenant.modules?.raffles?.settingsjson as Record<string, unknown> | undefined)?.defaultWhitelist,
        }
      : undefined

    return { tenant, marketplaceSettings: marketplaceOut, raffleSettings: raffleOut }
  })
}
