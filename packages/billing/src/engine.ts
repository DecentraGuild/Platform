import type {
  BillingPeriod,
  ConditionSet,
  PriceComponent,
  PriceResult,
  PricingModel,
  TieredAddonsPricing,
  TierDefinition,
  AddonDefinition,
} from './types.js'

function emptyResult(moduleId: string): PriceResult {
  return {
    moduleId,
    billable: false,
    components: [],
    oneTimeTotal: 0,
    recurringMonthly: 0,
    recurringYearly: 0,
    appliedYearlyDiscount: null,
    selectedTierId: null,
  }
}

/* ------------------------------------------------------------------ */
/*  tiered_addons: cheapest-path selection                            */
/* ------------------------------------------------------------------ */

interface TierCandidate {
  tier: TierDefinition
  components: PriceComponent[]
  recurringTotal: number
  qualified: boolean
}

function numericCondition(value: number | boolean | undefined): number {
  if (typeof value === 'number') return value
  return 0
}

function booleanCondition(value: number | boolean | undefined): boolean {
  return value === true
}

function evaluateTier(
  tier: TierDefinition,
  conditions: ConditionSet,
  addons: AddonDefinition[],
): TierCandidate | null {
  const components: PriceComponent[] = []
  let recurringTotal = tier.recurringPrice

  components.push({
    type: 'recurring',
    name: tier.name,
    quantity: 1,
    unitPrice: tier.recurringPrice,
    amount: tier.recurringPrice,
  })

  for (const [key, required] of Object.entries(conditions)) {
    const included = tier.included[key]

    if (typeof required === 'boolean') {
      if (required && !booleanCondition(included)) {
        return null
      }
      continue
    }

    const includedNum = numericCondition(included)
    const excess = required - includedNum
    if (excess <= 0) continue

    const addon = addons.find((a) => a.conditionKey === key)
    if (!addon) {
      return null
    }

    const units = Math.ceil(excess / addon.unitSize)
    const cost = units * addon.recurringPricePerUnit
    recurringTotal += cost
    components.push({
      type: 'recurring',
      name: addon.name,
      quantity: units,
      unitPrice: addon.recurringPricePerUnit,
      amount: cost,
    })
  }

  return { tier, components, recurringTotal, qualified: true }
}

function computeTieredAddons(
  moduleId: string,
  conditions: ConditionSet,
  pricing: TieredAddonsPricing,
  billingPeriod: BillingPeriod,
): PriceResult {
  const candidates: TierCandidate[] = []

  for (const tier of pricing.tiers) {
    const candidate = evaluateTier(tier, conditions, pricing.addons)
    if (candidate) candidates.push(candidate)
  }

  if (candidates.length === 0) {
    return emptyResult(moduleId)
  }

  candidates.sort((a, b) => a.recurringTotal - b.recurringTotal)
  const best = candidates[0]

  const yearlyDiscount = billingPeriod === 'yearly' ? pricing.yearlyDiscountPercent : 0
  const discountMultiplier = 1 - yearlyDiscount / 100
  const recurringMonthly = best.recurringTotal
  const recurringYearly = recurringMonthly * 12 * discountMultiplier

  return {
    moduleId,
    billable: true,
    components: best.components,
    oneTimeTotal: 0,
    recurringMonthly,
    recurringYearly,
    appliedYearlyDiscount: yearlyDiscount > 0 ? yearlyDiscount : null,
    selectedTierId: best.tier.id,
  }
}

/* ------------------------------------------------------------------ */
/*  one_time_per_unit                                                 */
/* ------------------------------------------------------------------ */

function computeOneTimePerUnit(
  moduleId: string,
  conditions: ConditionSet,
  pricing: { conditionKey: string; name: string; pricePerUnit: number },
): PriceResult {
  const quantity = numericCondition(conditions[pricing.conditionKey])
  const amount = quantity * pricing.pricePerUnit

  const components: PriceComponent[] = quantity > 0
    ? [{ type: 'one-time', name: pricing.name, quantity, unitPrice: pricing.pricePerUnit, amount }]
    : []

  return {
    moduleId,
    billable: quantity > 0,
    components,
    oneTimeTotal: amount,
    recurringMonthly: 0,
    recurringYearly: 0,
    appliedYearlyDiscount: null,
    selectedTierId: null,
  }
}

/* ------------------------------------------------------------------ */
/*  flat_recurring                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  flat_one_time                                                     */
/* ------------------------------------------------------------------ */

function computeFlatOneTime(
  moduleId: string,
  pricing: { name: string; amount: number },
): PriceResult {
  const amount = pricing.amount
  return {
    moduleId,
    billable: amount > 0,
    components: amount > 0
      ? [{ type: 'one-time', name: pricing.name, quantity: 1, unitPrice: amount, amount }]
      : [],
    oneTimeTotal: amount,
    recurringMonthly: 0,
    recurringYearly: 0,
    appliedYearlyDiscount: null,
    selectedTierId: null,
  }
}

/* ------------------------------------------------------------------ */
/*  flat_recurring                                                    */
/* ------------------------------------------------------------------ */

function computeFlatRecurring(
  moduleId: string,
  pricing: { name: string; recurringPrice?: number; recurringYearly?: number; yearlyDiscountPercent: number },
  billingPeriod: BillingPeriod,
): PriceResult {
  const yearlyDiscount = billingPeriod === 'yearly' ? pricing.yearlyDiscountPercent : 0
  const discountMultiplier = 1 - yearlyDiscount / 100

  const recurringYearly =
    pricing.recurringYearly != null
      ? pricing.recurringYearly * discountMultiplier
      : (pricing.recurringPrice ?? 0) * 12 * discountMultiplier
  const recurringMonthly = recurringYearly / 12
  const unitPrice = pricing.recurringYearly != null ? recurringYearly / 12 : (pricing.recurringPrice ?? 0)

  return {
    moduleId,
    billable: true,
    components: [{
      type: 'recurring',
      name: pricing.name,
      quantity: 1,
      unitPrice,
      amount: unitPrice,
    }],
    oneTimeTotal: 0,
    recurringMonthly,
    recurringYearly,
    appliedYearlyDiscount: yearlyDiscount > 0 ? yearlyDiscount : null,
    selectedTierId: null,
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export function computePrice(
  moduleId: string,
  conditions: ConditionSet,
  pricingModel: PricingModel | null,
  options?: { billingPeriod?: BillingPeriod },
): PriceResult {
  if (!pricingModel) return emptyResult(moduleId)

  const billingPeriod = options?.billingPeriod ?? 'monthly'

  switch (pricingModel.modelType) {
    case 'tiered_addons':
      return computeTieredAddons(moduleId, conditions, pricingModel, billingPeriod)
    case 'one_time_per_unit':
      return computeOneTimePerUnit(moduleId, conditions, pricingModel)
    case 'flat_recurring':
      return computeFlatRecurring(moduleId, pricingModel, billingPeriod)
    case 'flat_one_time':
      return computeFlatOneTime(moduleId, pricingModel)
    default:
      return emptyResult(moduleId)
  }
}
