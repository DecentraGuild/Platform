import { query } from './client.js'

export type RoleRuleOperator = 'AND' | 'OR'
export type RoleConditionType = 'SPL' | 'NFT' | 'TRAIT' | 'DISCORD'

/** Single source of truth for condition types. API and tenant use this to drive dropdowns and validation. */
export const DISCORD_CONDITION_TYPES: Array<{ id: RoleConditionType; label: string }> = [
  { id: 'SPL', label: 'SPL' },
  { id: 'NFT', label: 'NFT' },
  { id: 'TRAIT', label: 'Trait' },
  { id: 'DISCORD', label: 'Discord role' },
]

export interface DiscordRoleRuleRow {
  id: number
  discord_guild_id: string
  discord_role_id: string
  operator: RoleRuleOperator
  created_at: string
  updated_at: string
}

export type LogicToNext = 'AND' | 'OR' | null

/** Type-specific payload shapes. Stored in condition.payload (JSONB). */
export type SPLPayload = { mint: string; threshold_raw: number }
export type NFTPayload = { collection_or_mint: string; amount?: number }
export type TRAITPayload = {
  collection_or_mint: string
  trait_key: string
  trait_value: string
  amount?: number
}
export type DISCORDPayload = { required_role_id: string }

export type ConditionPayload = SPLPayload | NFTPayload | TRAITPayload | DISCORDPayload

export interface DiscordRoleConditionRow {
  id: number
  role_rule_id: number
  type: RoleConditionType
  payload: ConditionPayload
  logic_to_next: LogicToNext
  created_at: string
}

/** Raw row from DB: payload is JSON. */
export interface DiscordRoleConditionRowRaw {
  id: number
  role_rule_id: number
  type: string
  payload: unknown
  logic_to_next: LogicToNext
  created_at: string
}

function parsePayload(type: string, payload: unknown): ConditionPayload {
  if (payload == null || typeof payload !== 'object') {
    if (type === 'DISCORD') return { required_role_id: '' }
    if (type === 'SPL') return { mint: '', threshold_raw: 1 }
    if (type === 'NFT') return { collection_or_mint: '', amount: 1 }
    if (type === 'TRAIT') return { collection_or_mint: '', trait_key: '', trait_value: '', amount: 1 }
    return payload as ConditionPayload
  }
  const p = payload as Record<string, unknown>
  if (type === 'SPL') {
    return {
      mint: typeof p.mint === 'string' ? p.mint : '',
      threshold_raw: typeof p.threshold_raw === 'number' && p.threshold_raw >= 0 ? p.threshold_raw : 1,
    }
  }
  if (type === 'NFT') {
    const amount =
      typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount > 0 ? p.amount : 1
    return {
      collection_or_mint: typeof p.collection_or_mint === 'string' ? p.collection_or_mint : '',
      amount,
    }
  }
  if (type === 'TRAIT') {
    const amount =
      typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount > 0 ? p.amount : 1
    return {
      collection_or_mint: typeof p.collection_or_mint === 'string' ? p.collection_or_mint : '',
      trait_key: typeof p.trait_key === 'string' ? p.trait_key : '',
      trait_value: typeof p.trait_value === 'string' ? p.trait_value : '',
      amount,
    }
  }
  if (type === 'DISCORD') {
    const fromSingle = typeof p.required_role_id === 'string' ? p.required_role_id : ''
    const fromLegacy = Array.isArray(p.required_role_ids) && typeof (p.required_role_ids as unknown[])[0] === 'string'
      ? (p.required_role_ids as string[])[0]!
      : ''
    return { required_role_id: fromSingle || fromLegacy }
  }
  return payload as ConditionPayload
}

function rowToCondition(row: DiscordRoleConditionRowRaw): DiscordRoleConditionRow {
  return {
    id: row.id,
    role_rule_id: row.role_rule_id,
    type: row.type as RoleConditionType,
    payload: parsePayload(row.type, row.payload),
    logic_to_next: row.logic_to_next,
    created_at: row.created_at,
  }
}

export async function getRoleRulesByGuildId(discordGuildId: string): Promise<DiscordRoleRuleRow[]> {
  const { rows } = await query<DiscordRoleRuleRow>(
    'SELECT * FROM discord_role_rules WHERE discord_guild_id = $1 ORDER BY id',
    [discordGuildId]
  )
  return rows
}

export async function getRoleRuleById(id: number): Promise<DiscordRoleRuleRow | null> {
  const { rows } = await query<DiscordRoleRuleRow>(
    'SELECT * FROM discord_role_rules WHERE id = $1',
    [id]
  )
  return rows[0] ?? null
}

export async function getConditionsByRoleRuleId(roleRuleId: number): Promise<DiscordRoleConditionRow[]> {
  const { rows } = await query<DiscordRoleConditionRowRaw>(
    'SELECT id, role_rule_id, type, payload, logic_to_next, created_at FROM discord_role_conditions WHERE role_rule_id = $1 ORDER BY id',
    [roleRuleId]
  )
  return rows.map(rowToCondition)
}

/** All conditions for all rules of a guild (one query). Use for role-cards and other batch flows to avoid N+1. */
export async function getConditionsByGuildId(discordGuildId: string): Promise<Map<number, DiscordRoleConditionRow[]>> {
  const { rows } = await query<DiscordRoleConditionRowRaw>(
    `SELECT c.id, c.role_rule_id, c.type, c.payload, c.logic_to_next, c.created_at
     FROM discord_role_conditions c
     JOIN discord_role_rules r ON r.id = c.role_rule_id
     WHERE r.discord_guild_id = $1
     ORDER BY c.role_rule_id, c.id`,
    [discordGuildId]
  )
  const map = new Map<number, DiscordRoleConditionRow[]>()
  for (const row of rows) {
    const cond = rowToCondition(row)
    const list = map.get(cond.role_rule_id) ?? []
    list.push(cond)
    map.set(cond.role_rule_id, list)
  }
  return map
}

export interface CreateRoleRuleInput {
  discord_guild_id: string
  discord_role_id: string
  operator: RoleRuleOperator
}

export async function createRoleRule(input: CreateRoleRuleInput): Promise<DiscordRoleRuleRow> {
  const { rows } = await query<DiscordRoleRuleRow>(
    `INSERT INTO discord_role_rules (discord_guild_id, discord_role_id, operator)
     VALUES ($1, $2, $3)
     ON CONFLICT (discord_guild_id, discord_role_id) DO UPDATE SET operator = EXCLUDED.operator, updated_at = NOW()
     RETURNING *`,
    [input.discord_guild_id, input.discord_role_id, input.operator]
  )
  if (!rows[0]) throw new Error('Failed to create role rule')
  return rows[0]
}

export interface CreateRoleConditionInput {
  role_rule_id: number
  type: RoleConditionType
  payload: ConditionPayload
  logic_to_next?: LogicToNext
}

export async function createRoleCondition(input: CreateRoleConditionInput): Promise<DiscordRoleConditionRow> {
  const logicToNext = input.logic_to_next === 'AND' || input.logic_to_next === 'OR' ? input.logic_to_next : null
  const { rows } = await query<DiscordRoleConditionRowRaw>(
    `INSERT INTO discord_role_conditions (role_rule_id, type, payload, logic_to_next)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id, role_rule_id, type, payload, logic_to_next, created_at`,
    [input.role_rule_id, input.type, JSON.stringify(input.payload), logicToNext]
  )
  if (!rows[0]) throw new Error('Failed to create role condition')
  return rowToCondition(rows[0])
}

export async function updateRoleRule(id: number, operator: RoleRuleOperator): Promise<DiscordRoleRuleRow | null> {
  const { rows } = await query<DiscordRoleRuleRow>(
    'UPDATE discord_role_rules SET operator = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [operator, id]
  )
  return rows[0] ?? null
}

export async function deleteRoleRule(id: number): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM discord_role_rules WHERE id = $1', [id])
  return (rowCount ?? 0) > 0
}

export async function deleteRoleCondition(id: number): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM discord_role_conditions WHERE id = $1', [id])
  return (rowCount ?? 0) > 0
}

/** Distinct condition types that appear in any condition for the guild. Used by engine to run only relevant loaders. */
export async function getConditionTypesByGuildId(discordGuildId: string): Promise<RoleConditionType[]> {
  const { rows } = await query<{ type: string }>(
    `SELECT DISTINCT c.type FROM discord_role_conditions c
     JOIN discord_role_rules r ON r.id = c.role_rule_id
     WHERE r.discord_guild_id = $1`,
    [discordGuildId]
  )
  const set = new Set<RoleConditionType>()
  for (const r of rows) {
    if (r.type === 'SPL' || r.type === 'NFT' || r.type === 'TRAIT' || r.type === 'DISCORD') set.add(r.type)
  }
  return [...set]
}

/** All distinct mint/collection asset ids used in SPL/NFT/TRAIT conditions for a guild (from payload). For holder sync and engine snapshot load. */
export async function getConfiguredMintsByGuildId(discordGuildId: string): Promise<string[]> {
  const { rows } = await query<{ asset_id: string }>(
    `SELECT DISTINCT
       CASE c.type
         WHEN 'SPL' THEN c.payload->>'mint'
         ELSE c.payload->>'collection_or_mint'
       END AS asset_id
     FROM discord_role_conditions c
     JOIN discord_role_rules r ON r.id = c.role_rule_id
     WHERE r.discord_guild_id = $1 AND c.type IN ('SPL', 'NFT', 'TRAIT')`,
    [discordGuildId]
  )
  return rows.map((r) => r.asset_id).filter(Boolean)
}

/** Configured assets with type for holder sync: SPL = token balance holders, NFT/TRAIT = collection owners. */
export async function getConfiguredAssetsByGuildId(
  discordGuildId: string
): Promise<Array<{ asset_id: string; type: 'SPL' | 'NFT' }>> {
  const { rows } = await query<{ asset_id: string; type: string }>(
    `SELECT DISTINCT
       CASE c.type
         WHEN 'SPL' THEN c.payload->>'mint'
         ELSE c.payload->>'collection_or_mint'
       END AS asset_id,
       CASE WHEN c.type = 'SPL' THEN 'SPL' ELSE 'NFT' END AS type
     FROM discord_role_conditions c
     JOIN discord_role_rules r ON r.id = c.role_rule_id
     WHERE r.discord_guild_id = $1 AND c.type IN ('SPL', 'NFT', 'TRAIT')`,
    [discordGuildId]
  )
  return rows
    .filter((r) => r.asset_id)
    .map((r) => ({ asset_id: r.asset_id!, type: r.type as 'SPL' | 'NFT' }))
}
