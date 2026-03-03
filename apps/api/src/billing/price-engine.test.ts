/**
 * Unit tests for the billing pricing engine (computePrice from @decentraguild/billing).
 * Ensures pricing models produce expected results.
 */

import { describe, it, expect } from 'vitest'
import { computePrice, getOneTimePerUnitForTier } from '@decentraguild/billing'

describe('computePrice', () => {
  it('add_unit: returns one-time amount and billable true when pricePerUnit > 0', () => {
    const result = computePrice(
      'whitelist',
      {},
      { modelType: 'add_unit', name: 'Whitelist', pricePerUnit: 25 },
      { billingPeriod: 'monthly' }
    )
    expect(result.billable).toBe(true)
    expect(result.oneTimeTotal).toBe(25)
    expect(result.recurringMonthly).toBe(0)
    expect(result.recurringYearly).toBe(0)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].type).toBe('one-time')
    expect(result.components[0].amount).toBe(25)
  })

  it('add_unit: returns billable false when pricePerUnit is 0', () => {
    const result = computePrice(
      'whitelist',
      {},
      { modelType: 'add_unit', name: 'Whitelist', pricePerUnit: 0 },
      { billingPeriod: 'monthly' }
    )
    expect(result.billable).toBe(false)
    expect(result.oneTimeTotal).toBe(0)
    expect(result.components).toHaveLength(0)
  })

  it('returns empty result when pricing model is null', () => {
    const result = computePrice('marketplace', {}, null, { billingPeriod: 'monthly' })
    expect(result.billable).toBe(false)
    expect(result.oneTimeTotal).toBe(0)
    expect(result.recurringMonthly).toBe(0)
    expect(result.recurringYearly).toBe(0)
    expect(result.moduleId).toBe('marketplace')
  })

  it('flat_recurring: applies yearly discount when billingPeriod is yearly', () => {
    const result = computePrice(
      'slug',
      {},
      {
        modelType: 'flat_recurring',
        name: 'Custom slug',
        recurringPrice: 100,
        yearlyDiscountPercent: 20,
      },
      { billingPeriod: 'yearly' }
    )
    expect(result.billable).toBe(true)
    expect(result.recurringMonthly).toBeCloseTo((100 * 12 * 0.8) / 12, 5)
    expect(result.recurringYearly).toBeCloseTo(100 * 12 * 0.8, 5)
    expect(result.appliedYearlyDiscount).toBe(20)
  })

  it('tiered_with_one_time_per_unit: tier selection and one-time per unit fields', () => {
    const pricing = {
      modelType: 'tiered_with_one_time_per_unit' as const,
      conditionKeys: ['raffleSlotsUsed'],
      tiers: [
        { id: 'base', name: 'Base', recurringPrice: 0, included: { raffleSlotsUsed: 1 }, oneTimePerUnit: 5 },
        { id: 'grow', name: 'Grow', recurringPrice: 15, included: { raffleSlotsUsed: 3 }, oneTimePerUnit: 0 },
        { id: 'pro', name: 'Pro', recurringPrice: 25, included: { raffleSlotsUsed: 999 }, oneTimePerUnit: 0 },
      ],
      addons: [],
      yearlyDiscountPercent: 25,
      oneTimeUnitName: 'Per raffle',
    }

    const resultBase = computePrice('raffles', { raffleSlotsUsed: 1 }, pricing, { billingPeriod: 'monthly' })
    expect(resultBase.billable).toBe(true)
    expect(resultBase.selectedTierId).toBe('base')
    expect(resultBase.recurringMonthly).toBe(0)
    expect(resultBase.oneTimePerUnitForSelectedTier).toBe(5)
    expect(resultBase.oneTimeUnitName).toBe('Per raffle')

    const resultGrow = computePrice('raffles', { raffleSlotsUsed: 3 }, pricing, { billingPeriod: 'monthly' })
    expect(resultGrow.selectedTierId).toBe('grow')
    expect(resultGrow.recurringMonthly).toBe(15)
    expect(resultGrow.oneTimePerUnitForSelectedTier).toBe(0)
    expect(resultGrow.oneTimeUnitName).toBe('Per raffle')

    const resultPro = computePrice('raffles', { raffleSlotsUsed: 5 }, pricing, { billingPeriod: 'monthly' })
    expect(resultPro.selectedTierId).toBe('pro')
    expect(resultPro.recurringMonthly).toBe(25)
    expect(resultPro.oneTimePerUnitForSelectedTier).toBe(0)
  })

  it('tiered_with_one_time_per_unit: applies yearly discount', () => {
    const pricing = {
      modelType: 'tiered_with_one_time_per_unit' as const,
      conditionKeys: ['raffleSlotsUsed'],
      tiers: [
        { id: 'grow', name: 'Grow', recurringPrice: 15, included: { raffleSlotsUsed: 3 } },
      ],
      addons: [],
      yearlyDiscountPercent: 25,
    }
    const result = computePrice('raffles', { raffleSlotsUsed: 2 }, pricing, { billingPeriod: 'yearly' })
    expect(result.recurringYearly).toBeCloseTo(15 * 12 * 0.75, 5)
    expect(result.appliedYearlyDiscount).toBe(25)
  })
})

describe('getOneTimePerUnitForTier', () => {
  const tieredWithOneTimePricing = {
    modelType: 'tiered_with_one_time_per_unit' as const,
    conditionKeys: ['raffleSlotsUsed'],
    tiers: [
      { id: 'base', name: 'Base', recurringPrice: 0, included: { raffleSlotsUsed: 1 }, oneTimePerUnit: 5 },
      { id: 'grow', name: 'Grow', recurringPrice: 15, included: { raffleSlotsUsed: 3 }, oneTimePerUnit: 0 },
    ],
    addons: [],
    yearlyDiscountPercent: 25,
  }

  it('returns one-time fee for tier that has oneTimePerUnit', () => {
    expect(getOneTimePerUnitForTier(tieredWithOneTimePricing, 'base')).toBe(5)
  })

  it('returns 0 for tier with oneTimePerUnit 0', () => {
    expect(getOneTimePerUnitForTier(tieredWithOneTimePricing, 'grow')).toBe(0)
  })

  it('returns 0 for unknown tier id', () => {
    expect(getOneTimePerUnitForTier(tieredWithOneTimePricing, 'unknown')).toBe(0)
  })

  it('returns 0 for non tiered_with_one_time_per_unit model', () => {
    expect(getOneTimePerUnitForTier({ modelType: 'tiered_addons', tiers: [], addons: [], yearlyDiscountPercent: 0, conditionKeys: [] }, 'base')).toBe(0)
    expect(getOneTimePerUnitForTier(null, 'base')).toBe(0)
  })
})
