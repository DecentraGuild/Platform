import type { FastifyInstance } from 'fastify'
import { Connection } from '@solana/web3.js'
import { getDasRpcUrl } from '@decentraguild/web3'
import { getPool } from '../db/client.js'
import { getMintMetadata, upsertMintMetadata } from '../db/marketplace-metadata.js'
import { fetchMintMetadataFromChain } from '@decentraguild/web3'
import { fetchSplAssetPreview, fetchCollectionPreview } from '../marketplace/asset-preview.js'
import { requireTenantAdmin } from './tenant-settings.js'
import { normalizeTenantSlug } from '../validate-slug.js'

export async function registerMarketplaceMetadataRoutes(app: FastifyInstance) {
  app.get<{ Params: { mint: string } }>('/api/v1/marketplace/metadata/mint/:mint', async (request, reply) => {
    const { mint } = request.params
    if (!mint || mint.length < 32) {
      return reply.status(400).send({ error: 'Invalid mint address' })
    }

    const pool = getPool()
    const cached = pool ? await getMintMetadata(mint) : null
    if (cached) {
      return {
        mint: cached.mint,
        name: cached.name,
        symbol: cached.symbol,
        image: cached.image,
        decimals: cached.decimals,
        sellerFeeBasisPoints: cached.sellerFeeBasisPoints ?? undefined,
        updatedAt: cached.updatedAt,
      }
    }

    const fetchParam = new URL(request.url, 'http://localhost').searchParams.get('fetch')
    if (fetchParam === '1' || fetchParam === 'true') {
      try {
        const connection = new Connection(getDasRpcUrl())
        const fetched = await fetchMintMetadataFromChain(connection, mint)
        if (pool) {
          await upsertMintMetadata(mint, {
            name: fetched.name,
            symbol: fetched.symbol,
            image: fetched.image,
            decimals: fetched.decimals,
            sellerFeeBasisPoints: fetched.sellerFeeBasisPoints ?? undefined,
          }).catch(() => {})
        }
        return {
          mint: fetched.mint,
          name: fetched.name,
          symbol: fetched.symbol,
          image: fetched.image,
          decimals: fetched.decimals,
          sellerFeeBasisPoints: fetched.sellerFeeBasisPoints,
        }
      } catch (e) {
        request.log.warn({ err: e, mint }, 'Failed to fetch mint metadata from chain')
      }
    }
    return reply.status(404).send({ error: 'Metadata not found', mint })
  })

  app.post<{
    Params: { slug: string }
    Body: { mints: string[] }
  }>('/api/v1/tenant/:slug/marketplace/metadata/refresh', async (request, reply) => {
    const slug = normalizeTenantSlug(request.params.slug)
    if (!slug) {
      return reply.status(400).send({ error: 'Invalid tenant slug' })
    }
    const auth = await requireTenantAdmin(request, reply, slug)
    if (!auth) return

    const body = (request.body ?? {}) as { mints?: string[] }
    const mints = Array.isArray(body.mints) ? body.mints.filter((m): m is string => typeof m === 'string' && m.length >= 32) : []
    if (mints.length === 0) {
      return reply.status(400).send({ error: 'mints array required with at least one valid mint address' })
    }
    if (mints.length > 50) {
      return reply.status(400).send({ error: 'Maximum 50 mints per request' })
    }

    const pool = getPool()
    if (!pool) {
      return reply.status(503).send({ error: 'Database not configured' })
    }

    const connection = new Connection(getDasRpcUrl())
    const results: Array<{ mint: string; ok: boolean }> = []

    for (const mint of mints) {
      try {
        const fetched = await fetchMintMetadataFromChain(connection, mint)
        await upsertMintMetadata(mint, {
          name: fetched.name,
          symbol: fetched.symbol,
          image: fetched.image,
          decimals: fetched.decimals,
          sellerFeeBasisPoints: fetched.sellerFeeBasisPoints ?? undefined,
        })
        results.push({ mint, ok: true })
      } catch (e) {
        request.log.warn({ err: e, mint }, 'Failed to fetch mint metadata')
        results.push({ mint, ok: false })
      }
    }

    return { refreshed: results }
  })

  app.get<{ Params: { mint: string } }>('/api/v1/marketplace/asset-preview/spl/:mint', async (request, reply) => {
    const { mint } = request.params
    if (!mint || mint.length < 32) {
      return reply.status(400).send({ error: 'Invalid mint address' })
    }
    try {
      const preview = await fetchSplAssetPreview(mint)
      return preview
    } catch (e) {
      request.log.warn({ err: e, mint }, 'SPL asset preview failed')
      return reply.status(404).send({
        error: 'Failed to fetch asset',
        message: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  })

  app.get<{ Params: { mint: string } }>('/api/v1/marketplace/asset-preview/collection/:mint', async (request, reply) => {
    const { mint } = request.params
    if (!mint || mint.length < 32) {
      return reply.status(400).send({ error: 'Invalid mint address' })
    }
    try {
      const preview = await fetchCollectionPreview(mint)
      return preview
    } catch (e) {
      request.log.warn({ err: e, mint }, 'Collection preview failed')
      return reply.status(404).send({
        error: 'Failed to fetch collection',
        message: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  })
}
