/**
 * Helpers for Discord role rules: condition payload building, response shaping, asset checks.
 * Used by routes/discord-rules.ts.
 */

import { getPool } from '../db/client.js'
import {
  type RoleRuleOperator,
  type RoleConditionType,
  type DiscordRoleConditionRow,
  type ConditionPayload,
  type SPLPayload,
  type NFTPayload,
  type TRAITPayload,
  type DISCORDPayload,
} from '../db/discord-rules.js'
import { getMintMetadata } from '../db/marketplace-metadata.js'
import { truncateAddress } from '@decentraguild/display'
import type { DasAsset } from '@decentraguild/web3'

export type { RoleRuleOperator, RoleConditionType, ConditionPayload }

export function parseOperator(v: unknown): RoleRuleOperator {
  if (v === 'OR') return 'OR'
  return 'AND'
}

export function parseConditionType(v: unknown): RoleConditionType {
  if (v === 'NFT' || v === 'TRAIT' || v === 'DISCORD') return v
  return 'SPL'
}

/** Convert threshold from token units (UI) to raw. SPL requires mint metadata (decimals); throws if missing. */
export async function thresholdTokenToRaw(
  mint: string,
  thresholdToken: number | string | null | undefined
): Promise<number> {
  const tokenNum = thresholdToken != null && thresholdToken !== '' ? Number(thresholdToken) : NaN
  if (Number.isNaN(tokenNum) || tokenNum < 0) return 1
  if (tokenNum === 0) return 0
  const meta = await getMintMetadata(mint)
  if (!meta || meta.decimals == null) {
    throw new Error('Mint metadata required. Use Load next to the mint field to fetch metadata first.')
  }
  return Math.round(tokenNum * 10 ** meta.decimals)
}

export interface ConditionResponseItem {
  id: number
  type: string
  payload: ConditionPayload
  logic_to_next: string | null
  mint_or_group: string
  threshold: number | null
  trait_key: string | null
  trait_value: string | null
  required_role_id: string
  amount: number | null
}

/** Condition response: payload + derived display fields for tenant UI. */
export async function conditionsForResponse(
  conditions: DiscordRoleConditionRow[]
): Promise<ConditionResponseItem[]> {
  const out: ConditionResponseItem[] = []
  for (const c of conditions) {
    const p = c.payload
    let mint_or_group = ''
    let threshold: number | null = null
    let trait_key: string | null = null
    let trait_value: string | null = null
    let required_role_id = ''
    let amount: number | null = null
    if (c.type === 'SPL') {
      const spl = p as SPLPayload
      mint_or_group = spl.mint ?? ''
      if (spl.threshold_raw != null) {
        try {
          const meta = getPool() ? await getMintMetadata(spl.mint) : null
          threshold = meta?.decimals != null ? spl.threshold_raw / 10 ** meta.decimals : spl.threshold_raw
        } catch {
          threshold = spl.threshold_raw
        }
      }
    } else if (c.type === 'NFT' || c.type === 'TRAIT') {
      const nft = p as NFTPayload | TRAITPayload
      mint_or_group = nft.collection_or_mint ?? ''
      if (typeof (nft as NFTPayload).amount === 'number') {
        amount = (nft as NFTPayload).amount!
      }
      if (c.type === 'TRAIT') {
        const t = p as TRAITPayload
        trait_key = t.trait_key ?? null
        trait_value = t.trait_value ?? null
      }
    } else if (c.type === 'DISCORD') {
      const disc = p as DISCORDPayload
      required_role_id = disc.required_role_id ?? ''
    }
    out.push({
      id: c.id,
      type: c.type,
      payload: p,
      logic_to_next: c.logic_to_next ?? null,
      mint_or_group,
      threshold,
      trait_key,
      trait_value,
      required_role_id,
      amount,
    })
  }
  return out
}

export function isFungible(asset: DasAsset): boolean {
  const iface = asset.interface ?? ''
  return iface === 'FungibleAsset' || iface === 'FungibleToken'
}

export function hasCollectionGrouping(asset: DasAsset): boolean {
  const groups = asset.grouping ?? []
  return groups.some((g) => g.group_key === 'collection')
}

/** Build ConditionPayload from API body (type + payload or legacy flat fields). */
export async function buildPayloadFromBody(
  type: RoleConditionType,
  body: {
    payload?: Record<string, unknown>
    mint_or_group?: string
    mint?: string
    collection_or_mint?: string
    threshold?: number
    threshold_raw?: number
    trait_key?: string
    trait_value?: string
    required_role_id?: string
    amount?: number
  }
): Promise<{ payload: ConditionPayload; mintOrGroupForValidation?: string }> {
  const payload = body.payload ?? {}
  if (type === 'SPL') {
    const mint = (payload.mint as string) ?? body.mint ?? body.mint_or_group ?? ''
    let threshold_raw = typeof payload.threshold_raw === 'number' ? payload.threshold_raw : undefined
    if (threshold_raw == null && (body.threshold != null || payload.threshold != null)) {
      const tokenVal = body.threshold ?? (payload.threshold as number)
      threshold_raw = await thresholdTokenToRaw(mint, tokenVal)
    }
    if (threshold_raw == null) threshold_raw = 1
    return { payload: { mint, threshold_raw }, mintOrGroupForValidation: mint }
  }
  if (type === 'NFT') {
    const collection_or_mint = (payload.collection_or_mint as string) ?? body.collection_or_mint ?? body.mint_or_group ?? ''
    const amountRaw = (payload.amount as number) ?? body.amount
    const amount =
      typeof amountRaw === 'number' && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 1
    return { payload: { collection_or_mint, amount }, mintOrGroupForValidation: collection_or_mint }
  }
  if (type === 'TRAIT') {
    const collection_or_mint =
      (payload.collection_or_mint as string) ?? body.collection_or_mint ?? body.mint_or_group ?? ''
    const trait_key = (payload.trait_key as string) ?? body.trait_key ?? ''
    const trait_value = (payload.trait_value as string) ?? body.trait_value ?? ''
    const amountRaw = (payload.amount as number) ?? body.amount
    const amount =
      typeof amountRaw === 'number' && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 1
    return {
      payload: { collection_or_mint, trait_key, trait_value, amount },
      mintOrGroupForValidation: collection_or_mint,
    }
  }
  if (type === 'DISCORD') {
    const required_role_id =
      (payload.required_role_id as string) ?? body.required_role_id ?? ''
    return { payload: { required_role_id: typeof required_role_id === 'string' ? required_role_id : '' } }
  }
  return { payload: {} as ConditionPayload }
}

export type RoleCardRequirementItem =
  | { type: 'text'; text: string }
  | { type: 'separator'; label: 'OR' | 'and' }

/** Map of role_id -> display info for resolving role names in DISCORD conditions. */
export interface RoleInfoMap {
  get(roleId: string): { name: string } | undefined
}

/**
 * Build human-readable requirement lines for a single rule's conditions.
 * Inserts "OR" or "and" between items based on logic_to_next.
 */
export async function buildRoleCardRequirements(
  conditions: DiscordRoleConditionRow[],
  roleInfoMap: RoleInfoMap
): Promise<RoleCardRequirementItem[]> {
  const out: RoleCardRequirementItem[] = []
  for (let i = 0; i < conditions.length; i++) {
    if (i > 0 && conditions[i - 1].logic_to_next) {
      out.push({
        type: 'separator',
        label: conditions[i - 1].logic_to_next === 'OR' ? 'OR' : 'and',
      })
    }
    const c = conditions[i]
    const p = c.payload
    let text = ''
    if (c.type === 'SPL') {
      const spl = p as SPLPayload
      const meta = getPool() ? await getMintMetadata(spl.mint) : null
      const amount =
        meta?.decimals != null ? spl.threshold_raw / 10 ** meta.decimals : spl.threshold_raw
      const tokenName = meta?.name ?? meta?.symbol ?? truncateAddress(spl.mint || '')
      text = `${amount} ${tokenName}`.trim() || truncateAddress(spl.mint || '')
    } else if (c.type === 'NFT') {
      const nft = p as NFTPayload
      const coll = nft.collection_or_mint || ''
      const meta = getPool() ? await getMintMetadata(coll) : null
      const name = meta?.name ?? meta?.symbol ?? truncateAddress(coll)
      text = `any NFT from ${name}`
    } else if (c.type === 'TRAIT') {
      const t = p as TRAITPayload
      const coll = t.collection_or_mint || ''
      const meta = getPool() ? await getMintMetadata(coll) : null
      const collName = meta?.name ?? meta?.symbol ?? truncateAddress(coll)
      const traitPart = [t.trait_key, t.trait_value].filter(Boolean).join(': ') || 'trait'
      text = `NFT from ${collName} with ${traitPart}`
    } else if (c.type === 'DISCORD') {
      const disc = p as DISCORDPayload
      const id = disc.required_role_id ?? ''
      const name = id ? (roleInfoMap.get(id)?.name ?? truncateAddress(id)) : ''
      text = name ? `Have ${name} on Discord` : 'Have role on Discord'
    }
    if (text) out.push({ type: 'text', text })
  }
  return out
}
