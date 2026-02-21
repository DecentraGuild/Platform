/**
 * Tests for the type-first rule engine: SPL, DISCORD, and mixed-type rules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeEligiblePerRole } from './rule-engine.js'
import type { DiscordRoleRuleRow, DiscordRoleConditionRow } from '../db/discord-rules.js'

const GUILD_ID = '123456789'

vi.mock('../db/discord-rules.js', () => ({
  getRoleRulesByGuildId: vi.fn(),
  getConditionsByRoleRuleId: vi.fn(),
}))

vi.mock('../db/discord-holder-snapshots.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db/discord-holder-snapshots.js')>()
  return {
    ...actual,
    getHolderSnapshot: vi.fn(),
  }
})

vi.mock('../db/wallet-discord-links.js', () => ({
  getAllWalletLinks: vi.fn(),
}))

const { getRoleRulesByGuildId, getConditionsByRoleRuleId } = await import('../db/discord-rules.js')
const { getHolderSnapshot } = await import('../db/discord-holder-snapshots.js')
const { getAllWalletLinks } = await import('../db/wallet-discord-links.js')

const mockGetRoleRulesByGuildId = vi.mocked(getRoleRulesByGuildId)
const mockGetConditionsByRoleRuleId = vi.mocked(getConditionsByRoleRuleId)
const mockGetHolderSnapshot = vi.mocked(getHolderSnapshot)
const mockGetAllWalletLinks = vi.mocked(getAllWalletLinks)

function rule(id: number, roleId: string): DiscordRoleRuleRow {
  return {
    id,
    discord_guild_id: GUILD_ID,
    discord_role_id: roleId,
    operator: 'AND',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function condition(
  id: number,
  ruleId: number,
  type: 'SPL' | 'NFT' | 'TRAIT' | 'DISCORD',
  payload: DiscordRoleConditionRow['payload'],
  logicToNext: 'AND' | 'OR' | null = null
): DiscordRoleConditionRow {
  return {
    id,
    role_rule_id: ruleId,
    type,
    payload,
    logic_to_next: logicToNext,
    created_at: new Date().toISOString(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rule-engine', () => {
  describe('SPL condition', () => {
    it('passes when user balance meets threshold', async () => {
      const mint = 'So11111111111111111111111111111111111111112'
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByRoleRuleId.mockResolvedValue([
        condition(1, 1, 'SPL', { mint, threshold_raw: 100 }, null),
      ])
      mockGetHolderSnapshot.mockResolvedValue([
        { wallet: 'walletA', amount: '150' },
        { wallet: 'walletB', amount: '50' },
      ])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'walletA', discord_user_id: 'user1' },
      ])

      const result = await computeEligiblePerRole(GUILD_ID)

      expect(result).toHaveLength(1)
      expect(result[0].discord_role_id).toBe('role1')
      expect(result[0].eligible_discord_user_ids).toContain('user1')
    })

    it('fails when user balance below threshold', async () => {
      const mint = 'So11111111111111111111111111111111111111112'
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByRoleRuleId.mockResolvedValue([
        condition(1, 1, 'SPL', { mint, threshold_raw: 200 }, null),
      ])
      mockGetHolderSnapshot.mockResolvedValue([{ wallet: 'walletA', amount: '100' }])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'walletA', discord_user_id: 'user1' },
      ])

      const result = await computeEligiblePerRole(GUILD_ID)

      expect(result[0].eligible_discord_user_ids).not.toContain('user1')
    })
  })

  describe('DISCORD condition', () => {
    it('passes when user has required role (OR)', async () => {
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByRoleRuleId.mockResolvedValue([
        condition(1, 1, 'DISCORD', { required_role_ids: ['roleA', 'roleB'], role_logic: 'OR' }, null),
      ])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'w1', discord_user_id: 'user1' },
      ])

      const memberRoles = new Map<string, string[]>()
      memberRoles.set('user1', ['roleB', 'roleC'])

      const result = await computeEligiblePerRole(GUILD_ID, { memberRolesByUserId: memberRoles })

      expect(result[0].eligible_discord_user_ids).toContain('user1')
    })

    it('fails when user missing required role (AND)', async () => {
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByRoleRuleId.mockResolvedValue([
        condition(1, 1, 'DISCORD', { required_role_ids: ['roleA', 'roleB'], role_logic: 'AND' }, null),
      ])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'w1', discord_user_id: 'user1' },
      ])

      const memberRoles = new Map<string, string[]>()
      memberRoles.set('user1', ['roleA'])

      const result = await computeEligiblePerRole(GUILD_ID, { memberRolesByUserId: memberRoles })

      expect(result[0].eligible_discord_user_ids).not.toContain('user1')
    })
  })

  describe('mixed SPL OR DISCORD', () => {
    it('passes when either condition is satisfied', async () => {
      const mint = 'So11111111111111111111111111111111111111112'
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByRoleRuleId.mockResolvedValue([
        condition(1, 1, 'SPL', { mint, threshold_raw: 1000 }, 'OR'),
        condition(2, 1, 'DISCORD', { required_role_ids: ['vip'], role_logic: 'OR' }, null),
      ])
      mockGetHolderSnapshot.mockResolvedValue([])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'w1', discord_user_id: 'user1' },
      ])

      const memberRoles = new Map<string, string[]>()
      memberRoles.set('user1', ['vip'])

      const result = await computeEligiblePerRole(GUILD_ID, { memberRolesByUserId: memberRoles })

      expect(result[0].eligible_discord_user_ids).toContain('user1')
    })
  })
})
