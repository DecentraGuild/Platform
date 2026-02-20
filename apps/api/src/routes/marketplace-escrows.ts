import type { FastifyInstance } from 'fastify'
import BN from 'bn.js'
import { Connection } from '@solana/web3.js'
import { fetchAllEscrows, fetchEscrowByAddress, getDasRpcUrl } from '@decentraguild/web3'
import { getScopeEntriesForTenant } from '../marketplace/scope.js'
import { normalizeTenantSlug } from '../validate-slug.js'

const ESCROWS_CACHE_TTL_MS = 60_000

/**
 * Human-readable threshold: escrows with less than this are considered completed (hidden until maker closes).
 * Converted to raw units using escrow decimals.
 */
const MIN_REMAINING_HUMAN = 0.0000001

function isEffectivelyComplete(remaining: BN, decimals: number): boolean {
  const rawThreshold = Math.max(1, Math.round(MIN_REMAINING_HUMAN * 10 ** decimals))
  return remaining.lt(new BN(rawThreshold))
}

interface EscrowCacheEntry {
  data: { escrows: unknown[] }
  expiresAt: number
}
const escrowsCache = new Map<string, EscrowCacheEntry>()

export async function registerMarketplaceEscrowsRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string }; Querystring: { maker?: string } }>(
    '/api/v1/tenant/:slug/marketplace/escrows',
    async (request, reply) => {
      const slug = normalizeTenantSlug(request.params.slug)
      if (!slug) {
        return reply.status(400).send({ error: 'Invalid tenant slug' })
      }
      const makerFilter = (request.query as { maker?: string }).maker?.trim() ?? null

      let scopeMints: Set<string>
      try {
        const entries = await getScopeEntriesForTenant(slug)
        scopeMints = new Set(entries.map((e) => e.mint))
      } catch {
        return reply.status(404).send({ error: 'Tenant or scope not found' })
      }

      reply.header('Cache-Control', 'public, max-age=60')

      const now = Date.now()
      const cacheKey = makerFilter ? `${slug}:${makerFilter}` : `${slug}:all`
      const cached = escrowsCache.get(cacheKey)
      if (cached && now < cached.expiresAt) {
        return cached.data
      }

      let rpcUrl: string
      try {
        rpcUrl = getDasRpcUrl()
      } catch {
        return reply.status(503).send({ error: 'HELIUS_RPC not configured' })
      }
      const connection = new Connection(rpcUrl)

      try {
        const all = await fetchAllEscrows(connection, makerFilter)
        const filtered = all.filter((e) => {
          const dep = e.account.depositToken.toBase58()
          const req = e.account.requestToken.toBase58()
          const bothInScope = scopeMints.has(dep) && scopeMints.has(req)
          const notComplete = !isEffectivelyComplete(
            e.account.tokensDepositRemaining,
            e.account.decimals
          )
          return bothInScope && notComplete
        })
        const data = {
          escrows: filtered.map((e) => ({
            publicKey: e.publicKey.toBase58(),
            account: {
              maker: e.account.maker.toBase58(),
              depositToken: e.account.depositToken.toBase58(),
              requestToken: e.account.requestToken.toBase58(),
              tokensDepositInit: e.account.tokensDepositInit.toString(),
              tokensDepositRemaining: e.account.tokensDepositRemaining.toString(),
              price: e.account.price,
              decimals: e.account.decimals,
              slippage: e.account.slippage,
              seed: e.account.seed.toString(),
              expireTimestamp: e.account.expireTimestamp.toString(),
              recipient: e.account.recipient.toBase58(),
              onlyRecipient: e.account.onlyRecipient,
              onlyWhitelist: e.account.onlyWhitelist,
              allowPartialFill: e.account.allowPartialFill,
              whitelist: e.account.whitelist.toBase58(),
            },
          })),
        }
        escrowsCache.set(cacheKey, { data, expiresAt: now + ESCROWS_CACHE_TTL_MS })
        return data
      } catch (e) {
        request.log.warn({ err: e, slug }, 'Escrow fetch failed')
        return reply.status(503).send({
          error: 'Failed to fetch escrows',
          message: e instanceof Error ? e.message : 'Unknown error',
        })
      }
    }
  )

  app.get<{ Params: { slug: string; escrowId: string } }>(
    '/api/v1/tenant/:slug/marketplace/escrows/:escrowId',
    async (request, reply) => {
      const slug = normalizeTenantSlug(request.params.slug)
      const escrowId = request.params.escrowId
      if (!slug) {
        return reply.status(400).send({ error: 'Invalid tenant slug' })
      }

      let scopeMints: Set<string>
      try {
        const entries = await getScopeEntriesForTenant(slug)
        scopeMints = new Set(entries.map((e) => e.mint))
      } catch {
        return reply.status(404).send({ error: 'Tenant or scope not found' })
      }

      let rpcUrl: string
      try {
        rpcUrl = getDasRpcUrl()
      } catch {
        return reply.status(503).send({ error: 'HELIUS_RPC not configured' })
      }
      const connection = new Connection(rpcUrl)

      try {
        const e = await fetchEscrowByAddress(connection, escrowId)
        if (!e) return reply.status(404).send({ error: 'Escrow not found' })

        const dep = e.account.depositToken.toBase58()
        const req = e.account.requestToken.toBase58()
        const bothInScope = scopeMints.has(dep) && scopeMints.has(req)
        if (!bothInScope) return reply.status(404).send({ error: 'Escrow not in tenant scope' })

        const notComplete = !isEffectivelyComplete(e.account.tokensDepositRemaining, e.account.decimals)
        if (!notComplete) return reply.status(404).send({ error: 'Escrow not found' })

        return reply.send({
          escrow: {
            publicKey: e.publicKey.toBase58(),
            account: {
              maker: e.account.maker.toBase58(),
              depositToken: e.account.depositToken.toBase58(),
              requestToken: e.account.requestToken.toBase58(),
              tokensDepositInit: e.account.tokensDepositInit.toString(),
              tokensDepositRemaining: e.account.tokensDepositRemaining.toString(),
              price: e.account.price,
              decimals: e.account.decimals,
              slippage: e.account.slippage,
              seed: e.account.seed.toString(),
              expireTimestamp: e.account.expireTimestamp.toString(),
              recipient: e.account.recipient.toBase58(),
              onlyRecipient: e.account.onlyRecipient,
              onlyWhitelist: e.account.onlyWhitelist,
              allowPartialFill: e.account.allowPartialFill,
              whitelist: e.account.whitelist.toBase58(),
            },
          },
        })
      } catch (e) {
        request.log.warn({ err: e, slug, escrowId }, 'Escrow fetch failed')
        return reply.status(503).send({
          error: 'Failed to fetch escrow',
          message: e instanceof Error ? e.message : 'Unknown error',
        })
      }
    }
  )
}
