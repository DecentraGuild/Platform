/**
 * Type-first rule engine: one condition type = one evaluation path.
 * Loads only the data each type needs; evaluators are pure (condition + context -> boolean).
 */

import {
  getRoleRulesByGuildId,
  getConditionsByRoleRuleId,
  type DiscordRoleConditionRow,
  type RoleConditionType,
  type SPLPayload,
  type NFTPayload,
  type TRAITPayload,
  type DISCORDPayload,
} from '../db/discord-rules.js'
import {
  getHolderSnapshot,
  isBalanceSnapshot,
  getHolderBalancesFromSnapshot,
  getHolderWalletsFromSnapshot,
  type HolderSnapshot,
} from '../db/discord-holder-snapshots.js'
import { getAllWalletLinks } from '../db/wallet-discord-links.js'

export interface EligibleRole {
  discord_role_id: string
  eligible_discord_user_ids: string[]
}

/** Per-user context: only what the engine has loaded. Each evaluator reads only what it needs. */
export interface RuleEngineContext {
  linkedWallets: string[]
  snapshotByAsset: Map<string, HolderSnapshot>
  discordRoleIds: string[]
}

type Evaluator = (condition: DiscordRoleConditionRow, context: RuleEngineContext) => boolean

function evaluateSPL(condition: DiscordRoleConditionRow, context: RuleEngineContext): boolean {
  const payload = condition.payload as SPLPayload
  if (!payload?.mint || context.linkedWallets.length === 0) return false
  const snapshot = context.snapshotByAsset.get(payload.mint)
  if (!snapshot) return false
  const thresholdRaw = typeof payload.threshold_raw === 'number' && payload.threshold_raw >= 0 ? payload.threshold_raw : 1
  if (isBalanceSnapshot(snapshot)) {
    const balances = getHolderBalancesFromSnapshot(snapshot)
    const totalRaw = context.linkedWallets.reduce((sum, w) => sum + (balances.get(w) ?? 0), 0)
    return totalRaw >= thresholdRaw
  }
  const wallets = getHolderWalletsFromSnapshot(snapshot)
  const hasAny = context.linkedWallets.some((w) => wallets.includes(w))
  return hasAny
}

function evaluateNFT(condition: DiscordRoleConditionRow, context: RuleEngineContext): boolean {
  const payload = condition.payload as NFTPayload
  if (!payload?.collection_or_mint || context.linkedWallets.length === 0) return false
  const snapshot = context.snapshotByAsset.get(payload.collection_or_mint)
  if (!snapshot) return false
  const wallets = getHolderWalletsFromSnapshot(snapshot)
  return context.linkedWallets.some((w) => wallets.includes(w))
}

function evaluateTRAIT(condition: DiscordRoleConditionRow, context: RuleEngineContext): boolean {
  const payload = condition.payload as TRAITPayload
  if (!payload?.collection_or_mint || context.linkedWallets.length === 0) return false
  const snapshot = context.snapshotByAsset.get(payload.collection_or_mint)
  if (!snapshot) return false
  const wallets = getHolderWalletsFromSnapshot(snapshot)
  const isHolder = context.linkedWallets.some((w) => wallets.includes(w))
  if (!isHolder) return false
  // Trait filter: when we have trait index in context we can require matching trait_key/trait_value; for now holder check only
  return true
}

function evaluateDISCORD(condition: DiscordRoleConditionRow, context: RuleEngineContext): boolean {
  const payload = condition.payload as DISCORDPayload
  if (!payload?.required_role_ids?.length) return false
  const roleSet = new Set(context.discordRoleIds)
  if (payload.role_logic === 'AND') {
    return payload.required_role_ids.every((id) => roleSet.has(id))
  }
  return payload.required_role_ids.some((id) => roleSet.has(id))
}

const EVALUATORS: Record<RoleConditionType, Evaluator> = {
  SPL: evaluateSPL,
  NFT: evaluateNFT,
  TRAIT: evaluateTRAIT,
  DISCORD: evaluateDISCORD,
}

function getEvaluator(type: RoleConditionType): Evaluator | null {
  return EVALUATORS[type] ?? null
}

function evaluateRule(
  conditions: DiscordRoleConditionRow[],
  context: RuleEngineContext
): boolean {
  if (conditions.length === 0) return false
  const results = conditions.map((c) => {
    const fn = getEvaluator(c.type)
    return fn ? fn(c, context) : false
  })
  if (conditions.length === 1) return results[0]!
  let value = results[0]!
  for (let i = 1; i < results.length; i++) {
    const op = conditions[i - 1]!.logic_to_next
    if (op === 'OR') value = value || results[i]!
    else value = value && results[i]!
  }
  return value
}

/** Collect asset ids from SPL/NFT/TRAIT conditions for snapshot loading. */
function getAssetIdsFromConditions(conditions: DiscordRoleConditionRow[]): string[] {
  const ids = new Set<string>()
  for (const c of conditions) {
    if (c.type === 'SPL' && (c.payload as SPLPayload).mint) ids.add((c.payload as SPLPayload).mint)
    if ((c.type === 'NFT' || c.type === 'TRAIT') && (c.payload as NFTPayload).collection_or_mint) {
      ids.add((c.payload as NFTPayload).collection_or_mint)
    }
  }
  return [...ids]
}

/**
 * Compute eligible Discord user IDs per role for a guild.
 * Batches wallet links in one query; loads snapshots only for asset ids used by SPL/NFT/TRAIT.
 * Optionally accepts member_roles (discord_user_id -> role_ids) for DISCORD conditions.
 */
export async function computeEligiblePerRole(
  discordGuildId: string,
  options?: { memberRolesByUserId?: Map<string, string[]> }
): Promise<EligibleRole[]> {
  const rules = await getRoleRulesByGuildId(discordGuildId)
  if (rules.length === 0) return []

  const conditionsByRule = new Map<number, DiscordRoleConditionRow[]>()
  const allAssetIds = new Set<string>()
  for (const rule of rules) {
    const conditions = await getConditionsByRoleRuleId(rule.id)
    conditionsByRule.set(rule.id, conditions)
    for (const id of getAssetIdsFromConditions(conditions)) allAssetIds.add(id)
  }

  const snapshotByAsset = new Map<string, HolderSnapshot>()
  for (const assetId of allAssetIds) {
    const snap = await getHolderSnapshot(assetId)
    if (snap) snapshotByAsset.set(assetId, snap)
  }

  const allLinks = await getAllWalletLinks()
  const walletsByUserId = new Map<string, string[]>()
  for (const { wallet_address, discord_user_id } of allLinks) {
    const list = walletsByUserId.get(discord_user_id) ?? []
    list.push(wallet_address)
    walletsByUserId.set(discord_user_id, list)
  }

  const linkedUserIds = [...walletsByUserId.keys()]
  if (linkedUserIds.length === 0) return []

  const memberRolesByUserId = options?.memberRolesByUserId ?? new Map<string, string[]>()

  const result: EligibleRole[] = []
  for (const rule of rules) {
    const conditions = conditionsByRule.get(rule.id) ?? []
    const eligible: string[] = []
    for (const discordUserId of linkedUserIds) {
      const linkedWallets = walletsByUserId.get(discordUserId) ?? []
      if (linkedWallets.length === 0) continue
      const context: RuleEngineContext = {
        linkedWallets,
        snapshotByAsset,
        discordRoleIds: memberRolesByUserId.get(discordUserId) ?? [],
      }
      if (evaluateRule(conditions, context)) {
        eligible.push(discordUserId)
      }
    }
    result.push({ discord_role_id: rule.discord_role_id, eligible_discord_user_ids: eligible })
  }
  return result
}
