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
  required_role_ids: string[]
  role_logic: 'AND' | 'OR'
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
    let required_role_ids: string[] = []
    let role_logic: 'AND' | 'OR' = 'OR'
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
      if (c.type === 'TRAIT') {
        const t = p as TRAITPayload
        trait_key = t.trait_key ?? null
        trait_value = t.trait_value ?? null
      }
    } else if (c.type === 'DISCORD') {
      const disc = p as DISCORDPayload
      required_role_ids = disc.required_role_ids ?? []
      role_logic = disc.role_logic ?? 'OR'
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
      required_role_ids,
      role_logic,
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
    required_role_ids?: string[]
    role_logic?: string
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
    return { payload: { collection_or_mint }, mintOrGroupForValidation: collection_or_mint }
  }
  if (type === 'TRAIT') {
    const collection_or_mint =
      (payload.collection_or_mint as string) ?? body.collection_or_mint ?? body.mint_or_group ?? ''
    const trait_key = (payload.trait_key as string) ?? body.trait_key ?? ''
    const trait_value = (payload.trait_value as string) ?? body.trait_value ?? ''
    return {
      payload: { collection_or_mint, trait_key, trait_value },
      mintOrGroupForValidation: collection_or_mint,
    }
  }
  if (type === 'DISCORD') {
    const required_role_ids = (payload.required_role_ids as string[]) ?? body.required_role_ids ?? []
    const role_logic = (payload.role_logic as 'AND' | 'OR') ?? (body.role_logic === 'AND' ? 'AND' : 'OR')
    return { payload: { required_role_ids: Array.isArray(required_role_ids) ? required_role_ids : [], role_logic } }
  }
  return { payload: {} as ConditionPayload }
}
