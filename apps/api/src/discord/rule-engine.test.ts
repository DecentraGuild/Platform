/**
 * Tests for the type-first rule engine: SPL, DISCORD, and mixed-type rules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeEligiblePerRole } from './rule-engine.js'
import type { DiscordRoleRuleRow, DiscordRoleConditionRow } from '../db/discord-rules.js'

const GUILD_ID = '123456789'

vi.mock('../db/discord-rules.js', () => ({
  getRoleRulesByGuildId: vi.fn(),
  getConditionsByGuildId: vi.fn(),
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

const { getRoleRulesByGuildId, getConditionsByGuildId } = await import('../db/discord-rules.js')
const { getHolderSnapshot } = await import('../db/discord-holder-snapshots.js')
const { getAllWalletLinks } = await import('../db/wallet-discord-links.js')

const mockGetRoleRulesByGuildId = vi.mocked(getRoleRulesByGuildId)
const mockGetConditionsByGuildId = vi.mocked(getConditionsByGuildId)
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

/** Build conditions Map for getConditionsByGuildId mock: ruleId -> conditions. */
function conditionsMap(entries: Array<[number, DiscordRoleConditionRow[]]>): Map<number, DiscordRoleConditionRow[]> {
  return new Map(entries)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rule-engine', () => {
  describe('SPL condition', () => {
    it('passes when user balance meets threshold', async () => {
      const mint = 'So11111111111111111111111111111111111111112'
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([[1, [condition(1, 1, 'SPL', { mint, threshold_raw: 100 }, null)]]])
      )
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
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([[1, [condition(1, 1, 'SPL', { mint, threshold_raw: 200 }, null)]]])
      )
      mockGetHolderSnapshot.mockResolvedValue([{ wallet: 'walletA', amount: '100' }])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'walletA', discord_user_id: 'user1' },
      ])

      const result = await computeEligiblePerRole(GUILD_ID)

      expect(result[0].eligible_discord_user_ids).not.toContain('user1')
    })
  })

  describe('DISCORD condition', () => {
    it('passes when user has required role', async () => {
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([[1, [condition(1, 1, 'DISCORD', { required_role_id: 'roleB' }, null)]]])
      )
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'w1', discord_user_id: 'user1' },
      ])

      const memberRoles = new Map<string, string[]>()
      memberRoles.set('user1', ['roleB', 'roleC'])

      const result = await computeEligiblePerRole(GUILD_ID, { memberRolesByUserId: memberRoles })

      expect(result[0].eligible_discord_user_ids).toContain('user1')
    })

    it('fails when user missing required role', async () => {
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role1')])
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([[1, [condition(1, 1, 'DISCORD', { required_role_id: 'roleX' }, null)]]])
      )
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
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([
          [
            1,
            [
              condition(1, 1, 'SPL', { mint, threshold_raw: 1000 }, 'OR'),
              condition(2, 1, 'DISCORD', { required_role_id: 'vip' }, null),
            ],
          ],
        ])
      )
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

  describe('NFT and TRAIT amount conditions', () => {
    it('NFT passes when user holds enough NFTs', async () => {
      const collection = 'COLLECTION1111111111111111111111111111111'
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role-nft')])
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([[1, [condition(1, 1, 'NFT', { collection_or_mint: collection, amount: 2 }, null)]]])
      )
      mockGetHolderSnapshot.mockResolvedValue([
        { wallet: 'walletA', amount: '2' },
        { wallet: 'walletB', amount: '1' },
      ])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'walletA', discord_user_id: 'user1' },
      ])

      const result = await computeEligiblePerRole(GUILD_ID)

      expect(result).toHaveLength(1)
      expect(result[0].discord_role_id).toBe('role-nft')
      expect(result[0].eligible_discord_user_ids).toContain('user1')
    })

    it('NFT fails when user holds too few NFTs', async () => {
      const collection = 'COLLECTION1111111111111111111111111111111'
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role-nft')])
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([[1, [condition(1, 1, 'NFT', { collection_or_mint: collection, amount: 3 }, null)]]])
      )
      mockGetHolderSnapshot.mockResolvedValue([{ wallet: 'walletA', amount: '2' }])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'walletA', discord_user_id: 'user1' },
      ])

      const result = await computeEligiblePerRole(GUILD_ID)

      expect(result[0].eligible_discord_user_ids).not.toContain('user1')
    })

    it('TRAIT uses amount with holder snapshots', async () => {
      const collection = 'COLLECTION1111111111111111111111111111111'
      mockGetRoleRulesByGuildId.mockResolvedValue([rule(1, 'role-trait')])
      mockGetConditionsByGuildId.mockResolvedValue(
        conditionsMap([
          [
            1,
            [
              condition(
                1,
                1,
                'TRAIT',
                { collection_or_mint: collection, trait_key: 'background', trait_value: 'blue', amount: 2 },
                null
              ),
            ],
          ],
        ])
      )
      mockGetHolderSnapshot.mockResolvedValue([
        { wallet: 'walletA', amount: '2' },
        { wallet: 'walletB', amount: '1' },
      ])
      mockGetAllWalletLinks.mockResolvedValue([
        { wallet_address: 'walletA', discord_user_id: 'user1' },
      ])

      const result = await computeEligiblePerRole(GUILD_ID)

      expect(result).toHaveLength(1)
      expect(result[0].discord_role_id).toBe('role-trait')
      expect(result[0].eligible_discord_user_ids).toContain('user1')
    })
  })
})
