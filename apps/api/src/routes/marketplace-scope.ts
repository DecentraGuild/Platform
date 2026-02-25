import type { FastifyInstance } from 'fastify'
import {
  getScopeEntriesForTenant,
  getScopeEntriesPaginated,
  getScopeForTenant,
} from '../marketplace/scope.js'
import { expandAndSaveScope } from '../marketplace/expand-collections.js'
import { getMintMetadataBatch } from '../db/marketplace-metadata.js'
import { resolveMarketplace } from '../db/marketplace-settings.js'
import { getPool } from '../db/client.js'
import { normalizeTenantSlug } from '../validate-slug.js'
import { apiError, ErrorCode } from '../api-errors.js'

const ASSET_TYPE_MAP = {
  collection: 'NFT_COLLECTION',
  currency: 'CURRENCY',
  spl_asset: 'SPL_ASSET',
} as const

export async function registerMarketplaceScopeRoutes(app: FastifyInstance) {
  app.post<{ Params: { slug: string } }>('/api/v1/tenant/:slug/marketplace/scope/expand', async (request, reply) => {
    const slug = normalizeTenantSlug(request.params.slug)
    if (!slug) {
      return reply.status(400).send(apiError('Invalid tenant slug', ErrorCode.INVALID_SLUG))
    }
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send(apiError('Not found', ErrorCode.NOT_FOUND))
    }
    const config = await resolveMarketplace(slug)
    if (!config) {
      return reply.status(404).send(apiError('Marketplace config not found', ErrorCode.MARKETPLACE_NOT_FOUND, { slug }))
    }
    try {
      const entries = await expandAndSaveScope(slug, config, request.log)
      const mints = await getScopeForTenant(slug)
      return { ok: true, mintsCount: mints.length, message: `Scope expanded: ${entries.length} entries` }
    } catch (e) {
      request.log.error({ err: e, slug }, 'Scope expansion failed')
      return reply.status(500).send(apiError('Scope expansion failed', ErrorCode.INTERNAL_ERROR, {
        message: e instanceof Error ? e.message : 'Unknown error',
      }))
    }
  })

  app.get<{ Params: { slug: string } }>('/api/v1/tenant/:slug/marketplace/scope', async (request, reply) => {
    const slug = normalizeTenantSlug(request.params.slug)
    if (!slug) {
      return reply.status(400).send(apiError('Invalid tenant slug', ErrorCode.INVALID_SLUG))
    }
    reply.header('Cache-Control', 'public, max-age=60')
    const entries = await getScopeEntriesForTenant(slug)
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
    const slug = normalizeTenantSlug(request.params.slug)
    if (!slug) {
      return { assets: [], total: 0, page: 1, limit: 24, scope: { mints: [], entries: [] } }
    }
    const { page = '1', limit = '24', collection, search } = request.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24))

    const { entries: pageEntries, total } = await getScopeEntriesPaginated(slug, {
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

    const fullScope = await getScopeEntriesForTenant(slug)
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
