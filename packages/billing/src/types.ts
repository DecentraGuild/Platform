/** Flat key-value map produced per module from its config. Engine input. */
export type ConditionSet = Record<string, number | boolean>

export type BillingPeriod = 'monthly' | 'yearly'

export interface PriceComponent {
  type: 'one-time' | 'recurring'
  name: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface PriceResult {
  moduleId: string
  billable: boolean
  components: PriceComponent[]
  oneTimeTotal: number
  recurringMonthly: number
  recurringYearly: number
  appliedYearlyDiscount: number | null
  selectedTierId: string | null
}

/* ------------------------------------------------------------------ */
/*  Pricing model variants (discriminated union by modelType)         */
/* ------------------------------------------------------------------ */

export interface TierDefinition {
  id: string
  name: string
  recurringPrice: number
  /** Limits/features included in this tier, keyed by condition name. */
  included: Record<string, number | boolean>
  features?: string[]
}

export interface AddonDefinition {
  conditionKey: string
  name: string
  unitSize: number
  recurringPricePerUnit: number
}

export interface TieredAddonsPricing {
  modelType: 'tiered_addons'
  tiers: TierDefinition[]
  addons: AddonDefinition[]
  yearlyDiscountPercent: number
  conditionKeys: string[]
}

export interface OneTimePerUnitPricing {
  modelType: 'one_time_per_unit'
  conditionKey: string
  name: string
  pricePerUnit: number
}

export interface FlatRecurringPricing {
  modelType: 'flat_recurring'
  name: string
  /** Monthly price, or used as base when recurringYearly is not set. */
  recurringPrice?: number
  /** Canonical yearly price (avoids float rounding when price is e.g. 10 USDC/yr). */
  recurringYearly?: number
  yearlyDiscountPercent: number
}

export interface FlatOneTimePricing {
  modelType: 'flat_one_time'
  name: string
  amount: number
}

export type PricingModel =
  | TieredAddonsPricing
  | OneTimePerUnitPricing
  | FlatRecurringPricing
  | FlatOneTimePricing
