import type { FastifyInstance } from 'fastify'
import { fetchMintMetadataFromChain } from '@decentraguild/web3'
import { getSolanaConnection } from '../solana-connection.js'
import { getPool } from '../db/client.js'
import { isValidDiscordSnowflake, isValidMintOrGroup } from '../validate-discord.js'
import { getDiscordServerByTenantSlug } from '../db/discord-servers.js'
import { getRolesByGuildId, upsertGuildRoles } from '../db/discord-guild-roles.js'
import {
  getRoleRulesByGuildId,
  getRoleRuleById,
  getConditionsByRoleRuleId,
  getConditionsByGuildId,
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
import {
  getDiscordMintsByGuildId,
  createDiscordMint,
  getDiscordMintById,
  isAssetUsedInRules,
  deleteDiscordMint,
  type DiscordGuildMintKind,
} from '../db/discord-guild-mints.js'
import { getMintMetadata, upsertMintMetadata } from '../db/marketplace-metadata.js'
import { getHolderSnapshot, getHolderWalletsFromSnapshot } from '../db/discord-holder-snapshots.js'
import { logDiscordAudit } from '../db/discord-audit.js'
import { normalizeTenantIdentifier } from '../validate-slug.js'
import { resolveTenant } from '../db/tenant.js'
import { requireTenantAdmin, requireTenantAdminWithDiscordServer } from './tenant-settings.js'
import { adminWriteRateLimit } from '../rate-limit-strict.js'
import { apiError, ErrorCode } from '../api-errors.js'
import {
  parseOperator,
  parseConditionType,
  conditionsForResponse,
  buildPayloadFromBody,
  buildRoleCardRequirements,
  type RoleInfoMap,
  type ConditionPayload,
} from '../discord/rules-helpers.js'
import { buildCollectionPreview } from '../discord/collection-preview.js'
import { getWalletFromRequest } from './auth.js'
import { getLinkByWallet } from '../db/wallet-discord-links.js'
import { computeEligiblePerRole } from '../discord/rule-engine.js'

/** Returns validated mint from query, or sends 400 and returns null. */
function parseMintQuery(
  request: { query?: { mint?: string } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  errorLabel = 'Invalid mint address'
): string | null {
  const mint = (request.query?.mint ?? '').trim()
  if (!mint || mint.length < 32) {
    reply.status(400).send(apiError(errorLabel, ErrorCode.BAD_REQUEST))
    return null
  }
  if (!isValidMintOrGroup(mint)) {
    reply.status(400).send(apiError('Invalid mint format', ErrorCode.BAD_REQUEST))
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
          const fetched = await fetchMintMetadataFromChain(getSolanaConnection(), mint)
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
        return reply.status(404).send(apiError('Metadata not found', ErrorCode.NOT_FOUND, { mint }))
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
        return reply.status(400).send(apiError('Use fetch=1 to load and index the collection', ErrorCode.BAD_REQUEST))
      }
      try {
        const payload = await buildCollectionPreview(mint, request.log)
        return reply.send(payload)
      } catch (err) {
        const isNotFound = err instanceof Error && err.message === 'Asset not found'
        if (isNotFound) {
          return reply.status(404).send(apiError('Asset not found', ErrorCode.NOT_FOUND, { mint }))
        }
        request.log.error({ err, mint }, 'Collection preview failed')
        return reply.status(500).send(apiError(
          err instanceof Error ? err.message : 'Failed to load collection',
          ErrorCode.INTERNAL_ERROR,
          { mint }
        ))
      }
    }
  )

  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/roles',
    async (request, reply) => {
      const result = await requireTenantAdmin(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) return reply.send({ roles: [], assignable_roles: [] })
      const server = await getDiscordServerByTenantSlug(result.tenant.id)
      if (!server) return reply.send({ roles: [], assignable_roles: [] })
      const allRoles = await getRolesByGuildId(server.discord_guild_id)
      const roles = allRoles.map((r) => ({
        id: r.role_id,
        name: r.name,
        position: r.position,
        color: r.color ?? undefined,
        icon: r.icon ?? undefined,
        unicode_emoji: r.unicode_emoji ?? undefined,
      }))
      const assignable_roles =
        server.bot_role_position != null
          ? roles.filter((r) => (r.position ?? 0) < server.bot_role_position!)
          : []
      return reply.send({ roles, assignable_roles })
    }
  )

  /** Public: role cards for Discord page carousel (no admin). Returns human-readable requirements per role.
   * When user is signed in with a Discord-linked wallet, adds eligible per card (based on holdings). */
  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/role-cards',
    async (request, reply) => {
      const slug = normalizeTenantIdentifier(request.params.slug ?? '')
      if (!slug) {
        return reply.status(400).send(apiError('Invalid tenant slug', ErrorCode.INVALID_SLUG))
      }
      const tenant = await resolveTenant(slug)
      if (!tenant) return reply.send({ role_cards: [] })
      if (!getPool()) return reply.send({ role_cards: [] })
      const server = await getDiscordServerByTenantSlug(tenant.id)
      if (!server) return reply.send({ role_cards: [] })
      const guildId = server.discord_guild_id
      const [rules, roles, conditionsByRuleId] = await Promise.all([
        getRoleRulesByGuildId(guildId),
        getRolesByGuildId(guildId),
        getConditionsByGuildId(guildId),
      ])
      const roleById = new Map(roles.map((r) => [r.role_id, r]))
      const roleInfoMap: RoleInfoMap = {
        get(roleId: string) {
          const r = roleById.get(roleId)
          return r ? { name: r.name } : undefined
        },
      }
      let eligibleByRoleId = new Map<string, boolean>()
      const wallet = await getWalletFromRequest(request)
      if (wallet) {
        const link = await getLinkByWallet(wallet)
        if (link?.discord_user_id) {
          const eligiblePerRole = await computeEligiblePerRole(guildId)
          for (const { discord_role_id, eligible_discord_user_ids } of eligiblePerRole) {
            eligibleByRoleId.set(
              discord_role_id,
              eligible_discord_user_ids.includes(link.discord_user_id)
            )
          }
        }
      }
      const role_cards = await Promise.all(
        rules.map(async (rule) => {
          const role = roleById.get(rule.discord_role_id)
          const conditions = conditionsByRuleId.get(rule.id) ?? []
          const requirements = await buildRoleCardRequirements(conditions, roleInfoMap)
          const eligible = eligibleByRoleId.has(rule.discord_role_id)
            ? eligibleByRoleId.get(rule.discord_role_id)!
            : undefined
          return {
            role_id: rule.discord_role_id,
            name: role?.name ?? 'Role',
            color: role?.color ?? undefined,
            icon: role?.icon ?? undefined,
            unicode_emoji: role?.unicode_emoji ?? undefined,
            position: role?.position ?? 0,
            requirements,
            eligible,
          }
        })
      )
      role_cards.sort((a, b) => b.position - a.position)
      return reply.send({ role_cards })
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
        const server = await getDiscordServerByTenantSlug(result.tenant.id)
        if (!server) return reply.send({ rules: [], configured_mint_count: 0 })
        const [rules, conditionsByRuleId] = await Promise.all([
          getRoleRulesByGuildId(server.discord_guild_id),
          getConditionsByGuildId(server.discord_guild_id),
        ])
        const rulesWithConditions = await Promise.all(
          rules.map(async (r) => {
            const conditions = conditionsByRuleId.get(r.id) ?? []
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
        return reply.status(500).send(apiError(message, ErrorCode.INTERNAL_ERROR))
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
        required_role_id?: string
        payload?: Record<string, unknown>
        logic_to_next?: string | null
      }>
    }
  }>(
    '/api/v1/tenant/:slug/discord/rules',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      try {
        const result = await requireTenantAdminWithDiscordServer(request, reply, request.params.slug)
        if (!result) return
        const { server } = result
        const body = request.body ?? {}
        const discordRoleId = String(body.discord_role_id ?? '').trim()
        if (!discordRoleId || !isValidDiscordSnowflake(discordRoleId)) {
          return reply.status(400).send(apiError('discord_role_id required (valid Discord role ID)', ErrorCode.BAD_REQUEST))
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
            return reply.status(400).send(apiError(
              err instanceof Error ? err.message : 'Invalid condition payload',
              ErrorCode.BAD_REQUEST
            ))
          }
          if (built.mintOrGroupForValidation !== undefined) {
            const mintOrGroup = String(built.mintOrGroupForValidation ?? '').trim()
            if (!mintOrGroup || !isValidMintOrGroup(mintOrGroup)) continue
          }
          if (type === 'DISCORD') {
            const disc = built.payload as DISCORDPayload
            if (!disc.required_role_id?.trim()) continue
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
        return reply.status(500).send(apiError(message, ErrorCode.INTERNAL_ERROR))
      }
    }
  )

  app.get<{ Params: { slug: string; id: string } }>(
    '/api/v1/tenant/:slug/discord/rules/:id',
    async (request, reply) => {
      const result = await requireTenantAdminWithDiscordServer(request, reply, request.params.slug)
      if (!result) return
      const { server } = result
      const id = Number(request.params.id)
      if (!Number.isInteger(id)) return reply.status(400).send(apiError('Invalid rule id', ErrorCode.BAD_REQUEST))
      const rule = await getRoleRuleById(id)
      if (!rule || rule.discord_guild_id !== server.discord_guild_id) {
        return reply.status(404).send(apiError('Rule not found', ErrorCode.NOT_FOUND))
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
        required_role_id?: string
        payload?: Record<string, unknown>
        logic_to_next?: string | null
      }>
    }
  }>(
    '/api/v1/tenant/:slug/discord/rules/:id',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdminWithDiscordServer(request, reply, request.params.slug)
      if (!result) return
      const { server } = result
      const id = Number(request.params.id)
      if (!Number.isInteger(id)) return reply.status(400).send(apiError('Invalid rule id', ErrorCode.BAD_REQUEST))
      const rule = await getRoleRuleById(id)
      if (!rule || rule.discord_guild_id !== server.discord_guild_id) {
        return reply.status(404).send(apiError('Rule not found', ErrorCode.NOT_FOUND))
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
            return reply.status(400).send(apiError(
              err instanceof Error ? err.message : 'Invalid condition payload',
              ErrorCode.BAD_REQUEST
            ))
          }
          if (built.mintOrGroupForValidation !== undefined) {
            const mintOrGroup = String(built.mintOrGroupForValidation ?? '').trim()
            if (!mintOrGroup || !isValidMintOrGroup(mintOrGroup)) continue
          }
          if (type === 'DISCORD') {
            const disc = built.payload as DISCORDPayload
            if (!disc.required_role_id?.trim()) continue
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
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdminWithDiscordServer(request, reply, request.params.slug)
      if (!result) return
      const { server } = result
      const id = Number(request.params.id)
      if (!Number.isInteger(id)) return reply.status(400).send(apiError('Invalid rule id', ErrorCode.BAD_REQUEST))
      const rule = await getRoleRuleById(id)
      if (!rule || rule.discord_guild_id !== server.discord_guild_id) {
        return reply.status(404).send(apiError('Rule not found', ErrorCode.NOT_FOUND))
      }
      await deleteRoleRule(id)
      await logDiscordAudit('rule_delete', { rule_id: id }, server.discord_guild_id)
      return reply.send({ ok: true })
    }
  )

  app.get<{ Params: { slug: string } }>(
    '/api/v1/tenant/:slug/discord/mints',
    async (request, reply) => {
      const result = await requireTenantAdminWithDiscordServer(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) return reply.send({ mints: [] })
      const { server } = result
      const rows = await getDiscordMintsByGuildId(server.discord_guild_id)
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const meta = await getMintMetadata(row.asset_id).catch(() => null)
          const traitIndex = row.trait_index ?? null
          return {
            id: row.id,
            asset_id: row.asset_id,
            kind: row.kind,
            label: row.label,
            symbol: meta?.symbol ?? null,
            image: meta?.image ?? null,
            decimals: meta?.decimals ?? null,
            trait_keys: traitIndex?.trait_keys ?? null,
            trait_options: traitIndex?.trait_options ?? null,
          }
        })
      )
      return reply.send({ mints: enriched })
    }
  )

  app.post<{
    Params: { slug: string }
    Body: {
      asset_id?: string
      kind?: DiscordGuildMintKind
    }
  }>(
    '/api/v1/tenant/:slug/discord/mints',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdminWithDiscordServer(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) {
        return reply
          .status(500)
          .send(apiError('Database not available for mint catalog', ErrorCode.INTERNAL_ERROR))
      }
      const { server } = result
      const body = request.body ?? {}
      const rawAssetId = String(body.asset_id ?? '').trim()
      if (!rawAssetId || rawAssetId.length < 32) {
        return reply
          .status(400)
          .send(apiError('asset_id required (mint or collection address)', ErrorCode.BAD_REQUEST))
      }
      if (!isValidMintOrGroup(rawAssetId)) {
        return reply
          .status(400)
          .send(apiError('Invalid mint or collection format', ErrorCode.BAD_REQUEST))
      }

      const explicitKind = body.kind
      let resolvedKind: DiscordGuildMintKind | null = null
      let label = rawAssetId
      /** When we have an NFT/collection, store its traits so rule forms do not refetch. */
      let traitIndex: { trait_keys: string[]; trait_options: Record<string, string[]> } | null = null

      // Try collection preview first (NFT/collection path). Use traitsOnly so we get trait dropdowns without full per-item DB writes.
      let collectionName: string | null = null
      try {
        const collection = await buildCollectionPreview(rawAssetId, request.log, {
          traitsOnly: true,
          maxItems: 2500,
        })
        collectionName = collection.name ?? null
        traitIndex = {
          trait_keys: collection.trait_keys ?? [],
          trait_options: collection.trait_options ?? {},
        }
        // Heuristic: if we loaded any items or trait keys, treat as NFT/collection.
        if (collection.items_loaded > 0 || collection.trait_keys.length > 0) {
          resolvedKind = 'NFT'
        }
      } catch (err) {
        // Ignore here; we will fall back to mint metadata.
        request.log.debug({ err, mint: rawAssetId }, 'Collection preview failed during mint catalog create')
      }

      let meta = await getMintMetadata(rawAssetId).catch(() => null)
      if (!meta) {
        try {
          const fetched = await fetchMintMetadataFromChain(getSolanaConnection(), rawAssetId)
          await upsertMintMetadata(rawAssetId, {
            name: fetched.name,
            symbol: fetched.symbol,
            image: fetched.image,
            decimals: fetched.decimals,
            sellerFeeBasisPoints: fetched.sellerFeeBasisPoints ?? undefined,
          }).catch((e) =>
            request.log.warn({ err: e, mint: rawAssetId }, 'Mint catalog: mint metadata upsert skipped')
          )
          meta = {
            mint: rawAssetId,
            name: fetched.name,
            symbol: fetched.symbol,
            image: fetched.image,
            decimals: fetched.decimals,
            sellerFeeBasisPoints: fetched.sellerFeeBasisPoints,
          }
        } catch (e) {
          request.log.warn(
            { err: e, mint: rawAssetId },
            'Mint catalog: failed to fetch mint metadata from chain'
          )
        }
      }

      if (!resolvedKind) {
        if (explicitKind) {
          resolvedKind = explicitKind
        } else if (meta && typeof meta.decimals === 'number' && meta.decimals > 0) {
          resolvedKind = 'SPL'
        } else if (collectionName) {
          resolvedKind = 'NFT'
        }
      }

      if (!resolvedKind) {
        return reply
          .status(400)
          .send(
            apiError(
              'Unable to determine if mint is SPL or NFT. Please try again with explicit kind.',
              ErrorCode.BAD_REQUEST
            )
          )
      }

      // For NFT without traits yet (e.g. explicit kind), fetch collection preview once to store trait index.
      if (resolvedKind === 'NFT' && !traitIndex) {
        try {
          const collection = await buildCollectionPreview(rawAssetId, request.log, {
            traitsOnly: true,
            maxItems: 2500,
          })
          traitIndex = {
            trait_keys: collection.trait_keys ?? [],
            trait_options: collection.trait_options ?? {},
          }
          if (!collectionName) collectionName = collection.name ?? null
        } catch (err) {
          request.log.debug({ err, mint: rawAssetId }, 'Trait index fetch skipped for NFT catalog entry')
        }
      }

      label =
        collectionName ??
        meta?.name ??
        meta?.symbol ??
        `${rawAssetId.slice(0, 4)}…${rawAssetId.slice(-4)}`

      const row = await createDiscordMint({
        discord_guild_id: server.discord_guild_id,
        asset_id: rawAssetId,
        kind: resolvedKind,
        label,
        trait_index: traitIndex,
      })

      const traitIndexOut = row.trait_index ?? null
      return reply.send({
        id: row.id,
        asset_id: row.asset_id,
        kind: row.kind,
        label: row.label,
        symbol: meta?.symbol ?? null,
        image: meta?.image ?? null,
        decimals: meta?.decimals ?? null,
        trait_keys: traitIndexOut?.trait_keys ?? null,
        trait_options: traitIndexOut?.trait_options ?? null,
      })
    }
  )

  app.delete<{ Params: { slug: string; id: string } }>(
    '/api/v1/tenant/:slug/discord/mints/:id',
    { preHandler: [adminWriteRateLimit] },
    async (request, reply) => {
      const result = await requireTenantAdminWithDiscordServer(request, reply, request.params.slug)
      if (!result) return
      if (!getPool()) return reply.status(500).send(apiError('Database not available', ErrorCode.INTERNAL_ERROR))
      const { server } = result
      const id = Number(request.params.id)
      if (!Number.isInteger(id)) {
        return reply.status(400).send(apiError('Invalid mint id', ErrorCode.BAD_REQUEST))
      }
      const mintRow = await getDiscordMintById(id, server.discord_guild_id)
      if (!mintRow) {
        return reply.status(404).send(apiError('Mint not found', ErrorCode.NOT_FOUND))
      }
      const used = await isAssetUsedInRules(server.discord_guild_id, mintRow.asset_id)
      if (used) {
        return reply
          .status(400)
          .send(
            apiError(
              'Mint is still used in one or more rules. Remove those conditions before deleting it from the catalog.',
              ErrorCode.BAD_REQUEST
            )
          )
      }
      const deleted = await deleteDiscordMint(id, server.discord_guild_id)
      if (!deleted) {
        return reply
          .status(500)
          .send(apiError('Failed to delete mint from catalog', ErrorCode.INTERNAL_ERROR))
      }
      return reply.send({ ok: true })
    }
  )
}
