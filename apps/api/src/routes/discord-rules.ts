import type { FastifyInstance } from 'fastify'
import { Connection } from '@solana/web3.js'
import { getDasRpcUrl, fetchMintMetadataFromChain, fetchAsset, fetchAssetsByGroup } from '@decentraguild/web3'
import { traitsFromDasAsset } from '../marketplace/das-traits.js'
import { getPool } from '../db/client.js'
import { isValidDiscordSnowflake, isValidMintOrGroup } from '../validate-discord.js'
import { getDiscordServerByTenantSlug } from '../db/discord-servers.js'
import { getRolesByGuildId } from '../db/discord-guild-roles.js'
import {
  getRoleRulesByGuildId,
  getRoleRuleById,
  getConditionsByRoleRuleId,
  createRoleRule,
  createRoleCondition,
  updateRoleRule,
  deleteRoleRule,
  deleteRoleCondition,
  getConfiguredMintsByGuildId,
  DISCORD_CONDITION_TYPES,
  type DiscordRoleConditionRow,
  type DISCORDPayload,
} from '../db/discord-rules.js'
import { getMintMetadata, upsertMintMetadata } from '../db/marketplace-metadata.js'
import { getHolderSnapshot, getHolderWalletsFromSnapshot } from '../db/discord-holder-snapshots.js'
import { logDiscordAudit } from '../db/discord-audit.js'
import { requireTenantAdmin } from './tenant-settings.js'
import {
  parseOperator,
  parseConditionType,
  conditionsForResponse,
  buildPayloadFromBody,
  isFungible,
  hasCollectionGrouping,
  type ConditionPayload,
} from '../discord/rules-helpers.js'

/** Returns validated mint from query, or sends 400 and returns null. */
function parseMintQuery(
  request: { query?: { mint?: string } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  errorLabel = 'Invalid mint address'
): string | null {
  const mint = (request.query?.mint ?? '').trim()
  if (!mint || mint.length < 32) {
    reply.status(400).send({ error: errorLabel })
    return null
  }
  if (!isValidMintOrGroup(mint)) {
    reply.status(400).send({ error: 'Invalid mint format' })
    return null
  }
  return mint
}

export async function registerDiscordRulesRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string }; Querystring: { mint?: string; fetch?: string } }>(
    '/api/v1/tenant/:slug/discord/mint-preview',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      const mint = parseMintQuery(request, reply)
      if (!mint) return
      let meta = getPool() ? await getMintMetadata(mint) : null
      const doFetch = request.query?.fetch === '1' || request.query?.fetch === 'true'
      if (!meta && doFetch) {
        try {
          const connection = new Connection(getDasRpcUrl())
          const fetched = await fetchMintMetadataFromChain(connection, mint)
          if (getPool()) {
            await upsertMintMetadata(mint, {
              name: fetched.name,
              symbol: fetched.symbol,
              image: fetched.image,
              decimals: fetched.decimals,
              sellerFeeBasisPoints: fetched.sellerFeeBasisPoints ?? undefined,
            }).catch((e) => request.log.warn({ err: e, mint }, 'Mint metadata upsert skipped'))
          }
          meta = {
            mint,
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
      let holderCount: number | null = null
      const snapshot = await getHolderSnapshot(mint)
      if (snapshot) holderCount = getHolderWalletsFromSnapshot(snapshot).length
      if (!meta && holderCount === null) {
        return reply.status(404).send({ error: 'Metadata not found', mint })
      }
      return reply.send({
        mint,
        name: meta?.name ?? null,
        symbol: meta?.symbol ?? null,
        image: meta?.image ?? null,
        decimals: meta?.decimals ?? null,
        traits: meta?.traits ?? null,
        holder_count: holderCount,
      })
    }
  )

  app.get<{ Params: { slug: string }; Querystring: { mint?: string; fetch?: string } }>(
    '/api/v1/tenant/:slug/discord/collection-preview',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      const mint = parseMintQuery(request, reply, 'Invalid mint or collection address')
      if (!mint) return
      const doFetch = request.query?.fetch === '1' || request.query?.fetch === 'true'
      if (!doFetch) {
        return reply.status(400).send({ error: 'Use fetch=1 to load and index the collection' })
      }
      try {
        const asset = await fetchAsset(mint)
        if (!asset) {
          return reply.status(404).send({ error: 'Asset not found', mint })
        }
        const traitKeysSet = new Set<string>()
        const traitOptionsMap = new Map<string, Set<string>>()
        let name: string | null = asset.content?.metadata?.name ?? null
        let image: string | null = asset.content?.links?.image ?? null
        let itemsLoaded = 0

        function addTraits(traits: Array<{ trait_type: string; value: string | number }>) {
          for (const t of traits) {
            const key = t.trait_type.trim()
            if (!key) continue
            traitKeysSet.add(key)
            const val = String(t.value).trim()
            if (!val) continue
            let set = traitOptionsMap.get(key)
            if (!set) {
              set = new Set<string>()
              traitOptionsMap.set(key, set)
            }
            set.add(val)
          }
        }

        if (isFungible(asset)) {
          const meta = getPool() ? await getMintMetadata(mint) : null
          const traits = meta?.traits ?? traitsFromDasAsset(asset)
          if (traits.length) addTraits(traits.map((t) => ({ trait_type: t.trait_type, value: t.value })))
          const trait_keys = [...traitKeysSet].sort()
          const trait_options: Record<string, string[]> = {}
          for (const k of trait_keys) {
            trait_options[k] = [...(traitOptionsMap.get(k) ?? [])].sort()
          }
          return reply.send({
            mint,
            name: name ?? meta?.name ?? null,
            image: image ?? meta?.image ?? null,
            trait_keys,
            trait_options,
            items_loaded: 0,
          })
        }

        if (hasCollectionGrouping(asset) || asset.id === mint) {
          let page = 1
          const limit = 1000
          let hasMore = true
          while (hasMore) {
            const resultPage = await fetchAssetsByGroup('collection', mint, page, limit)
            const items = resultPage?.items ?? []
            for (const item of items) {
              const itemMint = item.id ?? ''
              if (!itemMint) continue
              itemsLoaded++
              const meta = item.content?.metadata
              const traits = traitsFromDasAsset(item)
              if (traits.length) {
                const forDb = traits.map((t) => ({
                  trait_type: t.trait_type,
                  value: t.value,
                }))
                if (getPool()) {
                  await upsertMintMetadata(itemMint, {
                    name: meta?.name ?? null,
                    symbol: meta?.symbol ?? null,
                    image: item.content?.links?.image ?? null,
                    decimals: item.token_info?.decimals ?? null,
                    traits: forDb,
                  }).catch((e) => request.log.warn({ err: e, mint: itemMint }, 'Collection preview: mint metadata upsert skipped'))
                }
                addTraits(traits)
              }
            }
            hasMore = items.length >= limit
            page++
          }
        } else {
          const traits = traitsFromDasAsset(asset)
          if (getPool()) {
            await upsertMintMetadata(mint, {
              name: asset.content?.metadata?.name ?? null,
              symbol: asset.content?.metadata?.symbol ?? null,
              image: asset.content?.links?.image ?? null,
              decimals: asset.token_info?.decimals ?? null,
              traits: traits.length ? traits.map((t) => ({ trait_type: t.trait_type, value: t.value })) : undefined,
            }).catch((e) => request.log.warn({ err: e, mint }, 'Collection preview: single NFT metadata upsert skipped'))
          }
          if (traits.length) addTraits(traits)
        }

        const trait_keys = [...traitKeysSet].sort()
        const trait_options: Record<string, string[]> = {}
        for (const k of trait_keys) {
          trait_options[k] = [...(traitOptionsMap.get(k) ?? [])].sort()
        }
        return reply.send({
          mint,
          name,
          image,
          trait_keys,
          trait_options,
          items_loaded: itemsLoaded,
        })
      } catch (err) {
        request.log.error({ err, mint }, 'Collection preview failed')
        return reply.status(500).send({
          error: err instanceof Error ? err.message : 'Failed to load collection',
        })
      }
    }
  )

  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/roles',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) return reply.send({ roles: [], assignable_roles: [] })
      const server = await getDiscordServerByTenantSlug(result.tenant.slug)
      if (!server) return reply.send({ roles: [], assignable_roles: [] })
      const allRoles = await getRolesByGuildId(server.discord_guild_id)
      const roles = allRoles.map((r) => ({ id: r.role_id, name: r.name, position: r.position }))
      const assignable_roles =
        server.bot_role_position != null
          ? roles.filter((r) => (r.position ?? 0) < server.bot_role_position!)
          : roles
      return reply.send({ roles, assignable_roles })
    }
  )

  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/condition-types',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      return reply.send({ types: DISCORD_CONDITION_TYPES })
    }
  )

  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/rules',
    async (request, reply) => {
      try {
        const result = await requireTenantAdmin(request, reply, request.params.slug)
        if (!result) return
        if (!getPool()) return reply.send({ rules: [], configured_mint_count: 0 })
        const server = await getDiscordServerByTenantSlug(result.tenant.slug)
        if (!server) return reply.send({ rules: [], configured_mint_count: 0 })
        const rules = await getRoleRulesByGuildId(server.discord_guild_id)
        const rulesWithConditions = await Promise.all(
          rules.map(async (r) => {
            const conditions = await getConditionsByRoleRuleId(r.id)
            return {
              id: r.id,
              discord_role_id: r.discord_role_id,
              operator: r.operator,
              conditions: await conditionsForResponse(conditions),
            }
          })
        )
        const mints = await getConfiguredMintsByGuildId(server.discord_guild_id)
        const maxMintsPerTenant = process.env.DISCORD_MAX_MINTS_PER_TENANT
        const mint_cap = maxMintsPerTenant ? Number(maxMintsPerTenant) : null
        return reply.send({
          rules: rulesWithConditions,
          configured_mint_count: mints.length,
          mint_cap: mint_cap != null && !Number.isNaN(mint_cap) ? mint_cap : null,
        })
      } catch (err) {
        request.log.error({ err }, 'GET discord rules failed')
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: message })
      }
    }
  )

  app.post<{
    Params: { slug: string }
    Body: {
      discord_role_id: string
      operator?: string
      conditions?: Array<{
        type: string
        mint_or_group?: string
        mint?: string
        collection_or_mint?: string
        threshold?: number
        trait_key?: string
        trait_value?: string
        required_role_ids?: string[]
        role_logic?: string
        payload?: Record<string, unknown>
        logic_to_next?: string | null
      }>
    }
  }>(
    '/api/v1/tenant/:slug/discord/rules',
    async (request, reply) => {
      try {
        const result = await requireTenantAdmin(request, reply, request.params.slug)
        if (!result) return
        if (!getPool()) return reply.status(503).send({ error: 'Database not available' })
        const server = await getDiscordServerByTenantSlug(result.tenant.slug)
        if (!server) return reply.status(400).send({ error: 'Discord server not connected' })
        const body = request.body ?? {}
        const discordRoleId = String(body.discord_role_id ?? '').trim()
        if (!discordRoleId || !isValidDiscordSnowflake(discordRoleId)) {
          return reply.status(400).send({ error: 'discord_role_id required (valid Discord role ID)' })
        }
        const operator = parseOperator(body.operator)
        const conditions = Array.isArray(body.conditions) ? body.conditions : []
        const rule = await createRoleRule({
          discord_guild_id: server.discord_guild_id,
          discord_role_id: discordRoleId,
          operator,
        })
        for (const c of conditions) {
          const type = parseConditionType(c.type)
          let built: { payload: ConditionPayload; mintOrGroupForValidation?: string }
          try {
            built = await buildPayloadFromBody(type, c)
          } catch (err) {
            return reply.status(400).send({
              error: err instanceof Error ? err.message : 'Invalid condition payload',
            })
          }
          if (built.mintOrGroupForValidation !== undefined) {
            const mintOrGroup = String(built.mintOrGroupForValidation ?? '').trim()
            if (!mintOrGroup || !isValidMintOrGroup(mintOrGroup)) continue
          }
          if (type === 'DISCORD') {
            const disc = built.payload as DISCORDPayload
            if (!disc.required_role_ids?.length) continue
          }
          const logicToNext = c.logic_to_next === 'OR' ? 'OR' : c.logic_to_next === 'AND' ? 'AND' : null
          await createRoleCondition({
            role_rule_id: rule.id,
            type,
            payload: built.payload,
            logic_to_next: logicToNext,
          })
        }
        await logDiscordAudit('rule_create', { rule_id: rule.id, discord_role_id: discordRoleId }, server.discord_guild_id)
        const fullConditions = await getConditionsByRoleRuleId(rule.id)
        return reply.send({
          id: rule.id,
          discord_role_id: rule.discord_role_id,
          operator: rule.operator,
          conditions: await conditionsForResponse(fullConditions),
        })
      } catch (err) {
        request.log.error({ err }, 'POST discord rule failed')
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: message })
      }
    }
  )

  app.get<{ Params: { slug: string; id: string } }>(
    '/api/v1/tenant/:slug/discord/rules/:id',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) return reply.status(503).send({ error: 'Database not available' })
      const id = Number(request.params.id)
      if (!Number.isInteger(id)) return reply.status(400).send({ error: 'Invalid rule id' })
      const server = await getDiscordServerByTenantSlug(result.tenant.slug)
      if (!server) return reply.status(404).send({ error: 'Discord server not connected' })
      const rule = await getRoleRuleById(id)
      if (!rule || rule.discord_guild_id !== server.discord_guild_id) {
        return reply.status(404).send({ error: 'Rule not found' })
      }
      const conditions = await getConditionsByRoleRuleId(rule.id)
      return reply.send({
        id: rule.id,
        discord_role_id: rule.discord_role_id,
        operator: rule.operator,
        conditions: await conditionsForResponse(conditions),
      })
    }
  )

  app.patch<{
    Params: { slug: string; id: string }
    Body: {
      operator?: string
      conditions?: Array<{
        id?: number
        type: string
        mint_or_group?: string
        mint?: string
        collection_or_mint?: string
        threshold?: number
        trait_key?: string
        trait_value?: string
        required_role_ids?: string[]
        role_logic?: string
        payload?: Record<string, unknown>
        logic_to_next?: string | null
      }>
    }
  }>(
    '/api/v1/tenant/:slug/discord/rules/:id',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) return reply.status(503).send({ error: 'Database not available' })
      const id = Number(request.params.id)
      if (!Number.isInteger(id)) return reply.status(400).send({ error: 'Invalid rule id' })
      const server = await getDiscordServerByTenantSlug(result.tenant.slug)
      if (!server) return reply.status(404).send({ error: 'Discord server not connected' })
      const rule = await getRoleRuleById(id)
      if (!rule || rule.discord_guild_id !== server.discord_guild_id) {
        return reply.status(404).send({ error: 'Rule not found' })
      }
      const body = request.body ?? {}
      if (body.operator !== undefined) {
        await updateRoleRule(id, parseOperator(body.operator))
      }
      if (Array.isArray(body.conditions)) {
        const existing = await getConditionsByRoleRuleId(id)
        for (const c of existing) await deleteRoleCondition(c.id)
        for (const c of body.conditions) {
          const type = parseConditionType(c.type)
          let built: { payload: ConditionPayload; mintOrGroupForValidation?: string }
          try {
            built = await buildPayloadFromBody(type, c)
          } catch (err) {
            return reply.status(400).send({
              error: err instanceof Error ? err.message : 'Invalid condition payload',
            })
          }
          if (built.mintOrGroupForValidation !== undefined) {
            const mintOrGroup = String(built.mintOrGroupForValidation ?? '').trim()
            if (!mintOrGroup || !isValidMintOrGroup(mintOrGroup)) continue
          }
          if (type === 'DISCORD') {
            const disc = built.payload as DISCORDPayload
            if (!disc.required_role_ids?.length) continue
          }
          const logicToNext = c.logic_to_next === 'OR' ? 'OR' : c.logic_to_next === 'AND' ? 'AND' : null
          await createRoleCondition({
            role_rule_id: id,
            type,
            payload: built.payload,
            logic_to_next: logicToNext,
          })
        }
      }
      await logDiscordAudit('rule_update', { rule_id: id }, server.discord_guild_id)
      const updated = await getRoleRuleById(id)
      const conditions = updated ? await getConditionsByRoleRuleId(updated.id) : []
      return reply.send({
        id: updated!.id,
        discord_role_id: updated!.discord_role_id,
        operator: updated!.operator,
        conditions: await conditionsForResponse(conditions),
      })
    }
  )

  app.delete<{ Params: { slug: string; id: string } }>(
    '/api/v1/tenant/:slug/discord/rules/:id',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) return reply.status(503).send({ error: 'Database not available' })
      const id = Number(request.params.id)
      if (!Number.isInteger(id)) return reply.status(400).send({ error: 'Invalid rule id' })
      const server = await getDiscordServerByTenantSlug(result.tenant.slug)
      if (!server) return reply.status(404).send({ error: 'Discord server not connected' })
      const rule = await getRoleRuleById(id)
      if (!rule || rule.discord_guild_id !== server.discord_guild_id) {
        return reply.status(404).send({ error: 'Rule not found' })
      }
      await deleteRoleRule(id)
      await logDiscordAudit('rule_delete', { rule_id: id }, server.discord_guild_id)
      return reply.send({ ok: true })
    }
  )
}
