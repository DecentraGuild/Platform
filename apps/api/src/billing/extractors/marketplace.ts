import type { ConditionSet } from '@decentraguild/billing'
import { BASE_CURRENCY_MINT_ADDRESSES } from '@decentraguild/core'
import { resolveMarketplace } from '../../db/marketplace-settings.js'

export async function extractMarketplaceConditions(tenantId: string): Promise<ConditionSet> {
  const config = await resolveMarketplace(tenantId)
  if (!config) return { mintsCount: 0, baseCurrenciesCount: 0, customCurrenciesCount: 0, monetizeStorefront: false }

  const mintsCount = config.collectionMints.length
  const baseCurrenciesCount = config.currencyMints.filter((c) => BASE_CURRENCY_MINT_ADDRESSES.has(c.mint)).length
  const customCurrenciesCount = config.currencyMints.length - baseCurrenciesCount

  const fee = config.shopFee
  const monetizeStorefront =
    fee.makerFlatFee > 0 || fee.takerFlatFee > 0 || fee.makerPercentFee > 0 || fee.takerPercentFee > 0

  return { mintsCount, baseCurrenciesCount, customCurrenciesCount, monetizeStorefront }
}
