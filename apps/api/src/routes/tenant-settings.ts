import type { FastifyInstance } from 'fastify'
import { getPool } from '../db/client.js'
import { getTenantBySlug, updateTenant, mergeTenantPatch, type TenantSettingsPatch } from '../db/tenant.js'
import { getMarketplaceBySlug, upsertMarketplace } from '../db/marketplace-settings.js'
import type { TenantConfig } from '@decentraguild/core'
import { getWalletFromRequest } from './auth.js'
import {
  loadTenantBySlug,
  writeTenantBySlug,
  getTenantConfigDir,
} from '../config/registry.js'
import {
  loadMarketplaceBySlug,
  writeMarketplaceBySlug,
  getMarketplaceConfigDir,
  type MarketplaceConfig,
} from '../config/marketplace-registry.js'
import { expandAndSaveScope } from '../marketplace/expand-collections.js'
import { getMintMetadataBatch, upsertMintMetadata } from '../db/marketplace-metadata.js'
import { enrichMarketplaceConfigWithMetadata } from '../marketplace/enrich-config.js'
import { normalizeTenantSlug } from '../validate-slug.js'

const BASE_CURRENCY_MINTS: MarketplaceConfig['currencyMints'] = [
  { mint: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
  { mint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', name: 'Wrapped Bitcoin (Portal)', symbol: 'WBTC' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', name: 'Tether USD', symbol: 'USDT' },
]

const DEFAULT_WHITELIST = {
  programId: 'whi5uDPWK4rAE9Sus6hdxdHwsG1hjDBn6kXM6pyqwTn',
  account: '',
}

function normalizeToMarketplaceConfig(
  body: Record<string, unknown>,
  tenantSlug: string,
  tenantId?: string
): MarketplaceConfig {
  const collectionMints = Array.isArray(body.collectionMints)
    ? (body.collectionMints as Array<{
        mint: string
        name?: string
        image?: string
        sellerFeeBasisPoints?: number
        groupPath?: string[]
        collectionSize?: number
        uniqueTraitCount?: number
        traitTypes?: string[]
      }>).map((m) => ({
        mint: m.mint ?? '',
        name: m.name,
        image: m.image,
        sellerFeeBasisPoints: m.sellerFeeBasisPoints,
        groupPath: m.groupPath,
        collectionSize: m.collectionSize,
        uniqueTraitCount: m.uniqueTraitCount,
        traitTypes: m.traitTypes,
      }))
    : []

  const splAssetMints: MarketplaceConfig['splAssetMints'] = Array.isArray(body.splAssetMints)
    ? (body.splAssetMints as Array<{ mint: string; name?: string; symbol?: string; image?: string; decimals?: number; sellerFeeBasisPoints?: number }>).map((s) => ({
        mint: s.mint ?? '',
        name: s.name,
        symbol: s.symbol,
        image: s.image,
        decimals: s.decimals,
        sellerFeeBasisPoints: s.sellerFeeBasisPoints,
      }))
    : []

  let currencyMints: MarketplaceConfig['currencyMints'] = []
  if (Array.isArray(body.currencyMints) && body.currencyMints.length > 0) {
    currencyMints = (body.currencyMints as Array<{ mint: string; name?: string; symbol?: string; image?: string; decimals?: number; sellerFeeBasisPoints?: number }>).map((c) => ({
      mint: c.mint ?? '',
      name: c.name ?? '',
      symbol: c.symbol ?? '',
      image: c.image,
      decimals: c.decimals,
      sellerFeeBasisPoints: c.sellerFeeBasisPoints,
    }))
  } else {
    const base = (body.baseCurrency as string[]) ?? ['SOL', 'USDC']
    const custom = (body.customCurrencies as Array<{ mint: string; name?: string; symbol?: string }>) ?? []
    const baseSymbols = new Set(base)
    currencyMints = [...BASE_CURRENCY_MINTS.filter((b) => baseSymbols.has(b.symbol))]
    currencyMints.push(
      ...custom.filter((c) => c.mint?.trim()).map((c) => ({
        mint: c.mint!,
        name: c.name ?? '',
        symbol: c.symbol ?? '',
        image: (c as { image?: string }).image,
        decimals: (c as { decimals?: number }).decimals,
        sellerFeeBasisPoints: (c as { sellerFeeBasisPoints?: number }).sellerFeeBasisPoints,
      }))
    )
  }

  const sf = (body.shopFee ?? {}) as Record<string, unknown>
  const shopFee = {
    wallet: (sf.wallet as string) ?? '',
    makerFlatFee: Number(sf.makerFlatFee) || 0,
    takerFlatFee: Number(sf.takerFlatFee) || 0,
    makerPercentFee: Number(sf.makerPercentFee) || 0,
    takerPercentFee: Number(sf.takerPercentFee) || 0,
  }

  const wl = (body.whitelist ?? {}) as Record<string, unknown>
  const whitelist = {
    programId: (wl.programId as string) || DEFAULT_WHITELIST.programId,
    account: (wl.account as string) || '',
  }

  return { tenantSlug, tenantId, collectionMints, currencyMints, splAssetMints, whitelist, shopFee }
}

export async function requireTenantAdmin(
  request: Parameters<Parameters<FastifyInstance['get']>[1]>[0],
  reply: Parameters<Parameters<FastifyInstance['get']>[1]>[1],
  slugParam: string
): Promise<{ wallet: string; tenant: TenantConfig } | null> {
  const slug = normalizeTenantSlug(slugParam)
  if (!slug) {
    reply.status(400).send({ error: 'Invalid tenant slug' })
    return null
  }
  const wallet = await getWalletFromRequest(request)
  if (!wallet) {
    reply.status(401).send({ error: 'Authentication required' })
    return null
  }
  let tenant: TenantConfig | null = null
  if (getPool()) tenant = await getTenantBySlug(slug)
  if (!tenant) tenant = await loadTenantBySlug(slug)
  if (!tenant) {
    reply.status(404).send({ error: 'Tenant not found' })
    return null
  }
  const admins = tenant.admins ?? []
  if (!admins.includes(wallet)) {
    reply.status(403).send({ error: 'Admin access required' })
    return null
  }
  return { wallet, tenant }
}

export async function registerTenantSettingsRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/api/v1/tenant/:slug/settings', async (request, reply) => {
    const { slug } = request.params
    const result = await requireTenantAdmin(request, reply, slug)
    if (!result) return
    return { tenant: result.tenant }
  })

  app.patch<{
    Params: { slug: string }
    Body: TenantSettingsPatch
  }>('/api/v1/tenant/:slug/settings', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return
    const slug = result.tenant.slug
    const body = (request.body ?? {}) as Record<string, unknown>
    const ALLOWED_KEYS = ['name', 'description', 'branding', 'modules'] as const
    const patch: TenantSettingsPatch = {}
    for (const k of ALLOWED_KEYS) {
      if (k in body && body[k] !== undefined) patch[k] = body[k] as TenantSettingsPatch[typeof k]
    }

    if (getPool()) {
      const updated = await updateTenant(slug, patch)
      if (!updated) {
        return reply.status(404).send({ error: 'Tenant not found' })
      }
      return { tenant: updated }
    }

    const configDir = getTenantConfigDir()
    if (!configDir) {
      return reply.status(503).send({ error: 'Database not configured and TENANT_CONFIG_PATH not set' })
    }
    const existing = await loadTenantBySlug(slug)
    if (!existing) {
      return reply.status(404).send({ error: 'Tenant not found' })
    }
    const merged = mergeTenantPatch(existing, patch)
    try {
      await writeTenantBySlug(slug, merged)
    } catch (e) {
      request.log.warn({ err: e, slug }, 'Failed to write tenant config file')
      return reply.status(503).send({ error: 'Failed to save tenant config' })
    }
    return { tenant: merged }
  })

  app.get<{ Params: { slug: string } }>('/api/v1/tenant/:slug/marketplace-settings', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return
    const slug = result.tenant.slug
    let config: MarketplaceConfig | null = null
    if (getPool()) {
      try {
        config = await getMarketplaceBySlug(slug)
      } catch {
        // fall back to file
      }
    }
    if (!config) config = await loadMarketplaceBySlug(slug)
    if (config && getPool()) {
      const mints = [
        ...config.currencyMints.map((c) => c.mint),
        ...(config.splAssetMints ?? []).map((s) => s.mint),
      ]
      const metadataMap = await getMintMetadataBatch(mints)
      config = enrichMarketplaceConfigWithMetadata(config, metadataMap)
    }
    const settings = config
      ? {
          collectionMints: config.collectionMints,
          currencyMints: config.currencyMints,
          splAssetMints: config.splAssetMints ?? [],
          whitelist: config.whitelist ?? { programId: DEFAULT_WHITELIST.programId, account: '' },
          shopFee: config.shopFee,
        }
      : {}
    return { settings }
  })

  app.patch<{
    Params: { slug: string }
    Body: Record<string, unknown>
  }>('/api/v1/tenant/:slug/marketplace-settings', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return
    const slug = result.tenant.slug
    const body = (request.body ?? {}) as Record<string, unknown>
    const config = normalizeToMarketplaceConfig(body, slug, result.tenant.id)

    if (getPool()) {
      await upsertMarketplace(slug, result.tenant.id, {
        collectionMints: config.collectionMints,
        currencyMints: config.currencyMints,
        splAssetMints: config.splAssetMints ?? [],
        whitelist: config.whitelist,
        shopFee: config.shopFee,
      })
      for (const c of config.currencyMints) {
        if (c.mint?.trim()) {
          await upsertMintMetadata(c.mint.trim(), {
            name: c.name ?? null,
            symbol: c.symbol ?? null,
            image: c.image ?? null,
            decimals: c.decimals ?? null,
            sellerFeeBasisPoints: c.sellerFeeBasisPoints ?? null,
          }).catch((e) => request.log.warn({ err: e, mint: c.mint?.trim() }, 'Mint metadata upsert skipped'))
        }
      }
      for (const s of config.splAssetMints ?? []) {
        if (s.mint?.trim()) {
          await upsertMintMetadata(s.mint.trim(), {
            name: s.name ?? null,
            symbol: s.symbol ?? null,
            image: s.image ?? null,
            decimals: s.decimals ?? null,
            sellerFeeBasisPoints: s.sellerFeeBasisPoints ?? null,
          }).catch((e) => request.log.warn({ err: e, mint: s.mint?.trim() }, 'Mint metadata upsert skipped'))
        }
      }
      try {
        await expandAndSaveScope(slug, config, request.log)
      } catch (e) {
        request.log.warn({ err: e, slug }, 'Scope expansion failed; scope may be stale')
      }
      let updated = await getMarketplaceBySlug(slug)
      if (updated) {
        const mints = [
          ...updated.currencyMints.map((c) => c.mint),
          ...(updated.splAssetMints ?? []).map((s) => s.mint),
        ]
        const metadataMap = await getMintMetadataBatch(mints)
        updated = enrichMarketplaceConfigWithMetadata(updated, metadataMap)
      }
      return {
        settings: updated
          ? {
              collectionMints: updated.collectionMints,
              currencyMints: updated.currencyMints,
              splAssetMints: updated.splAssetMints ?? [],
              whitelist: updated.whitelist ?? { programId: DEFAULT_WHITELIST.programId, account: '' },
              shopFee: updated.shopFee,
            }
          : {},
      }
    }

    const configDir = getMarketplaceConfigDir()
    if (!configDir) {
      return reply.status(503).send({ error: 'MARKETPLACE_CONFIG_PATH not set' })
    }
    try {
      await writeMarketplaceBySlug(slug, config)
      try {
        await expandAndSaveScope(slug, config, request.log)
      } catch (e) {
        request.log.warn({ err: e, slug }, 'Scope expansion failed; scope may be stale')
      }
    } catch (e) {
      request.log.warn({ err: e, slug }, 'Failed to write marketplace config file')
      return reply.status(503).send({ error: 'Failed to save marketplace settings' })
    }
    return {
        settings: {
          collectionMints: config.collectionMints,
          currencyMints: config.currencyMints,
          splAssetMints: config.splAssetMints ?? [],
          whitelist: config.whitelist,
          shopFee: config.shopFee,
        },
    }
  })
}
