import type { FastifyInstance } from 'fastify'
import { getTenantSlugFromHost } from '@decentraguild/core'
import type { TenantConfigDiagnostic } from '../config/registry.js'
import { normalizeTenantSlug } from '../validate-slug.js'
import { loadTenantBySlug, loadTenantBySlugDiagnostic } from '../config/registry.js'
import { loadMarketplaceBySlug } from '../config/marketplace-registry.js'
import { getPool } from '../db/client.js'
import { getTenantBySlug } from '../db/tenant.js'
import { getMarketplaceBySlug } from '../db/marketplace-settings.js'
import { getMintMetadataBatch } from '../db/marketplace-metadata.js'
import { enrichMarketplaceConfigWithMetadata } from '../marketplace/enrich-config.js'
import { getWalletFromRequest } from './auth.js'

const CACHE_MAX_AGE_SECONDS = 60

export async function registerTenantContextRoutes(app: FastifyInstance) {
  app.get('/api/v1/tenant-context', async (request, reply) => {
    const { searchParams } = new URL(request.url, 'http://localhost')
    const slugParam = searchParams.get('slug')
    const host = request.headers.host ?? ''
    const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true'

    const rawSlug = slugParam ?? getTenantSlugFromHost(host, searchParams)
    const slug = rawSlug ? normalizeTenantSlug(rawSlug) : null

    if (!slug) {
      return reply.status(404).send({ error: rawSlug ? 'Invalid tenant slug' : 'Tenant slug required' })
    }

    let tenant = null
    if (getPool()) {
      try {
        tenant = await getTenantBySlug(slug)
      } catch {
        // DB not available or query failed
      }
    }
    if (!tenant) tenant = await loadTenantBySlug(slug)
    if (!tenant) {
      const body: { error: string; diagnostic?: TenantConfigDiagnostic } = {
        error: 'Tenant not found',
      }
      if (debug) body.diagnostic = await loadTenantBySlugDiagnostic(slug)
      return reply.status(404).send(body)
    }

    const wallet = await getWalletFromRequest(request)
    const isAdmin = wallet && Array.isArray(tenant.admins) && tenant.admins.includes(wallet)
    if (!isAdmin) {
      reply.header('Cache-Control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`)
    }

    let marketplaceSettings = null
    if (tenant.modules?.marketplace?.active) {
      if (getPool()) {
        try {
          marketplaceSettings = await getMarketplaceBySlug(slug)
        } catch {
          // fall back to file
        }
      }
      if (!marketplaceSettings) marketplaceSettings = await loadMarketplaceBySlug(slug)
      if (marketplaceSettings && getPool()) {
        const mints = [
          ...marketplaceSettings.currencyMints.map((c) => c.mint),
          ...(marketplaceSettings.splAssetMints ?? []).map((s) => s.mint),
        ]
        const metadataMap = await getMintMetadataBatch(mints)
        marketplaceSettings = enrichMarketplaceConfigWithMetadata(marketplaceSettings, metadataMap)
      }
    }

    return { tenant, marketplaceSettings: marketplaceSettings ?? undefined }
  })
}
