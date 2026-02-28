/**
 * Base currency mints for marketplace pricing and billing conditions.
 * SOL, WBTC, USDC, USDT. Single source of truth shared by API and tenant app.
 */

import type { MarketplaceCurrencyMint } from './types.js'

export const BASE_CURRENCY_MINTS: readonly MarketplaceCurrencyMint[] = [
  { mint: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
  { mint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', name: 'Wrapped Bitcoin (Portal)', symbol: 'WBTC' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', name: 'Tether USD', symbol: 'USDT' },
] as const

const _ADDR_SET = new Set(BASE_CURRENCY_MINTS.map((c) => c.mint))

/** Set of base currency mint addresses for O(1) lookup. */
export const BASE_CURRENCY_MINT_ADDRESSES: ReadonlySet<string> = _ADDR_SET

/** True if mint is a base currency (SOL, WBTC, USDC, USDT). */
export function isBaseCurrencyMint(mint: string): boolean {
  return _ADDR_SET.has(mint)
}
