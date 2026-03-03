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
  /** Fee for adding one unit on the selected tier (tiered_with_one_time_per_unit only). */
  oneTimePerUnitForSelectedTier?: number
  /** Display label for the one-time unit (e.g. "Per raffle"). */
  oneTimeUnitName?: string
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
  /** One-time fee per unit when adding on this tier (tiered_with_one_time_per_unit only). */
  oneTimePerUnit?: number
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

export interface TieredWithOneTimePerUnitPricing {
  modelType: 'tiered_with_one_time_per_unit'
  conditionKeys: string[]
  tiers: TierDefinition[]
  addons: AddonDefinition[]
  yearlyDiscountPercent: number
  /** Display name for the one-time unit (e.g. "Per raffle"). */
  oneTimeUnitName?: string
}

export interface OneTimePerUnitPricing {
  modelType: 'one_time_per_unit'
  conditionKey: string
  name: string
  pricePerUnit: number
}

/** Price for adding one unit (e.g. creating a new whitelist). Used when adding, not for total. */
export interface AddUnitPricing {
  modelType: 'add_unit'
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
  | TieredWithOneTimePerUnitPricing
  | OneTimePerUnitPricing
  | AddUnitPricing
  | FlatRecurringPricing
  | FlatOneTimePricing
