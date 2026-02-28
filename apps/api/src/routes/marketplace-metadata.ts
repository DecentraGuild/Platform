import type { FastifyInstance } from 'fastify'
import { getPool } from '../db/client.js'
import { getSolanaConnection } from '../solana-connection.js'
import { getMintMetadata, upsertMintMetadata } from '../db/marketplace-metadata.js'
import { fetchMintMetadataFromChain } from '@decentraguild/web3'
import { fetchSplAssetPreview, fetchCollectionPreview } from '../marketplace/asset-preview.js'
import { requireTenantAdmin } from './tenant-settings.js'
import { normalizeTenantIdentifier } from '../validate-slug.js'
import { apiError, ErrorCode } from '../api-errors.js'

const MAX_MINTS_PER_REFRESH = 50
const MIN_MINT_LENGTH = 32

export async function registerMarketplaceMetadataRoutes(app: FastifyInstance) {
  app.get<{ Params: { mint: string } }>('/api/v1/marketplace/metadata/mint/:mint', async (request, reply) => {
    const { mint } = request.params
    if (!mint || mint.length < MIN_MINT_LENGTH) {
      return reply.status(400).send(apiError('Invalid mint address', ErrorCode.BAD_REQUEST))
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
        const fetched = await fetchMintMetadataFromChain(getSolanaConnection(), mint)
        if (pool) {
          await upsertMintMetadata(mint, {
            name: fetched.name,
            symbol: fetched.symbol,
            image: fetched.image,
            decimals: fetched.decimals,
            sellerFeeBasisPoints: fetched.sellerFeeBasisPoints ?? undefined,
          }).catch((e) => request.log.warn({ err: e, mint }, 'Mint metadata cache upsert skipped'))
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
    return reply.status(404).send(apiError('Metadata not found', ErrorCode.NOT_FOUND, { mint }))
  })

  app.post<{
    Params: { slug: string }
    Body: { mints: string[] }
  }>('/api/v1/tenant/:slug/marketplace/metadata/refresh', async (request, reply) => {
    const slug = normalizeTenantIdentifier(request.params.slug)
    if (!slug) {
      return reply.status(400).send(apiError('Invalid tenant slug', ErrorCode.INVALID_SLUG))
    }
    const auth = await requireTenantAdmin(request, reply, slug)
    if (!auth) return

    const body = (request.body ?? {}) as { mints?: string[] }
    const mints = Array.isArray(body.mints) ? body.mints.filter((m): m is string => typeof m === 'string' && m.length >= MIN_MINT_LENGTH) : []
    if (mints.length === 0) {
      return reply.status(400).send(apiError('mints array required with at least one valid mint address', ErrorCode.BAD_REQUEST))
    }
    if (mints.length > MAX_MINTS_PER_REFRESH) {
      return reply.status(400).send(apiError(`Maximum ${MAX_MINTS_PER_REFRESH} mints per request`, ErrorCode.BAD_REQUEST))
    }

    const pool = getPool()
    if (!pool) {
      return reply.status(503).send(apiError('Database not configured', ErrorCode.SERVICE_UNAVAILABLE))
    }

    const connection = getSolanaConnection()
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
    if (!mint || mint.length < MIN_MINT_LENGTH) {
      return reply.status(400).send(apiError('Invalid mint address', ErrorCode.BAD_REQUEST))
    }
    try {
      const preview = await fetchSplAssetPreview(mint)
      return preview
    } catch (e) {
      request.log.warn({ err: e, mint }, 'SPL asset preview failed')
      return reply.status(404).send(apiError('Failed to fetch asset', ErrorCode.NOT_FOUND, {
        message: e instanceof Error ? e.message : 'Unknown error',
      }))
    }
  })

  app.get<{ Params: { mint: string } }>('/api/v1/marketplace/asset-preview/collection/:mint', async (request, reply) => {
    const { mint } = request.params
    if (!mint || mint.length < MIN_MINT_LENGTH) {
      return reply.status(400).send(apiError('Invalid mint address', ErrorCode.BAD_REQUEST))
    }
    try {
      const preview = await fetchCollectionPreview(mint)
      return preview
    } catch (e) {
      request.log.warn({ err: e, mint }, 'Collection preview failed')
      return reply.status(404).send(apiError('Failed to fetch collection', ErrorCode.NOT_FOUND, {
        message: e instanceof Error ? e.message : 'Unknown error',
      }))
    }
  })
}
