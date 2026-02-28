import type { FastifyInstance } from 'fastify'
import {
  getScopeEntriesForTenant,
  getScopeEntriesPaginated,
  getScopeForTenant,
} from '../marketplace/scope.js'
import { expandAndSaveScope } from '../marketplace/expand-collections.js'
import { getMintMetadataBatch } from '../db/marketplace-metadata.js'
import { resolveMarketplace } from '../db/marketplace-settings.js'
import { resolveTenant } from '../db/tenant.js'
import { getPool } from '../db/client.js'
import { normalizeTenantIdentifier } from '../validate-slug.js'
import { apiError, ErrorCode } from '../api-errors.js'

const MAX_ASSETS_PER_PAGE = 100
const DEFAULT_PAGE_SIZE = 24

const ASSET_TYPE_MAP = {
  collection: 'NFT_COLLECTION',
  currency: 'CURRENCY',
  spl_asset: 'SPL_ASSET',
} as const

export async function registerMarketplaceScopeRoutes(app: FastifyInstance) {
  app.post<{ Params: { slug: string } }>('/api/v1/tenant/:slug/marketplace/scope/expand', async (request, reply) => {
    const idOrSlug = normalizeTenantIdentifier(request.params.slug)
    if (!idOrSlug) {
      return reply.status(400).send(apiError('Invalid tenant identifier', ErrorCode.INVALID_SLUG))
    }
    const tenant = await resolveTenant(idOrSlug)
    if (!tenant) {
      return reply.status(404).send(apiError('Tenant not found', ErrorCode.TENANT_NOT_FOUND))
    }
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send(apiError('Not found', ErrorCode.NOT_FOUND))
    }
    const config = await resolveMarketplace(tenant.id)
    if (!config) {
      return reply.status(404).send(apiError('Marketplace config not found', ErrorCode.MARKETPLACE_NOT_FOUND, { tenantId: tenant.id }))
    }
    try {
      const entries = await expandAndSaveScope(tenant.id, config, request.log)
      const mints = await getScopeForTenant(tenant.id)
      return { ok: true, mintsCount: mints.length, message: `Scope expanded: ${entries.length} entries` }
    } catch (e) {
      request.log.error({ err: e, tenantId: tenant.id }, 'Scope expansion failed')
      return reply.status(500).send(apiError('Scope expansion failed', ErrorCode.INTERNAL_ERROR, {
        message: e instanceof Error ? e.message : 'Unknown error',
      }))
    }
  })

  app.get<{ Params: { slug: string } }>('/api/v1/tenant/:slug/marketplace/scope', async (request, reply) => {
    const idOrSlug = normalizeTenantIdentifier(request.params.slug)
    if (!idOrSlug) {
      return reply.status(400).send(apiError('Invalid tenant identifier', ErrorCode.INVALID_SLUG))
    }
    const tenant = await resolveTenant(idOrSlug)
    if (!tenant) {
      return reply.status(404).send(apiError('Tenant not found', ErrorCode.TENANT_NOT_FOUND))
    }
    reply.header('Cache-Control', 'public, max-age=60')
    const entries = await getScopeEntriesForTenant(tenant.id)
    return {
      mints: entries.map((e) => e.mint),
      entries: entries.map((e) => ({
        mint: e.mint,
        source: e.source,
        collectionMint: e.collectionMint ?? null,
      })),
    }
  })

  app.get<{
    Params: { slug: string }
    Querystring: { page?: string; limit?: string; collection?: string; search?: string }
  }>('/api/v1/tenant/:slug/marketplace/assets', async (request, _reply) => {
    const idOrSlug = normalizeTenantIdentifier(request.params.slug)
    if (!idOrSlug) {
      return { assets: [], total: 0, page: 1, limit: 24, scope: { mints: [], entries: [] } }
    }
    const tenant = await resolveTenant(idOrSlug)
    if (!tenant) {
      return { assets: [], total: 0, page: 1, limit: 24, scope: { mints: [], entries: [] } }
    }
    const { page = '1', limit = String(DEFAULT_PAGE_SIZE), collection, search } = request.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(MAX_ASSETS_PER_PAGE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE))

    const { entries: pageEntries, total } = await getScopeEntriesPaginated(tenant.id, {
      page: pageNum,
      limit: limitNum,
      collection: collection ?? null,
      search: search ?? null,
    })

    const metadataMap = await getMintMetadataBatch(pageEntries.map((e) => e.mint))

    const assets = pageEntries.map((e) => {
      const meta = metadataMap.get(e.mint)
      const assetType = ASSET_TYPE_MAP[e.source] ?? 'SPL_ASSET'
      return {
        assetType,
        mint: e.mint,
        collectionMint: e.collectionMint ?? null,
        metadata: meta
          ? {
              name: meta.name,
              symbol: meta.symbol,
              image: meta.image,
              decimals: meta.decimals,
              traits: meta.traits ?? null,
            }
          : null,
      }
    })

    const fullScope = await getScopeEntriesForTenant(tenant.id)
    const scope = {
      mints: fullScope.map((e) => e.mint),
      entries: fullScope.map((e) => ({
        mint: e.mint,
        source: e.source,
        collectionMint: e.collectionMint ?? null,
      })),
    }

    return {
      assets,
      total,
      page: pageNum,
      limit: limitNum,
      scope,
    }
  })
}
