/**
 * Token and amount formatting utilities for display.
 * Used by escrow, wallet, admin, future modules.
 */

/**
 * Convert raw token amount to human-readable number.
 * @param amount - Raw amount (BN, string, or number)
 * @param decimals - Token decimals (0 for NFTs)
 */
export function fromRawUnits(
  amount: { toString: () => string } | string | number | null | undefined,
  decimals: number
): number {
  if (amount === null || amount === undefined || amount === '0' || amount === 0) return 0

  const amountStr =
    typeof amount === 'object' && amount !== null && 'toString' in amount
      ? (amount as { toString: () => string }).toString()
      : String(amount)

  if (decimals === 0) {
    return parseInt(amountStr, 10) || 0
  }

  const padded = amountStr.padStart(decimals + 1, '0')
  const integerPart = padded.slice(0, -decimals) || '0'
  const decimalPart = padded.slice(-decimals)
  return parseFloat(`${integerPart}.${decimalPart}`) || 0
}

/**
 * Convert human amount to raw units (string for BN compatibility).
 */
export function toRawUnits(amount: number, decimals: number): string {
  if (!amount || amount === 0) return '0'

  const amountStr = typeof amount === 'number' ? amount.toString() : String(amount)
  const [integerPart, decimalPart = ''] = amountStr.split('.')
  const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals)
  return integerPart + paddedDecimal
}

/**
 * Sanitize token symbol/name for display: remove replacement characters, zero-width chars, and control chars.
 * On-chain metadata sometimes contains invalid or invisible Unicode that renders as boxes.
 */
export function sanitizeTokenLabel(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return s
    .replace(/\uFFFD/g, '') // Unicode replacement character (often shows as box)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width space, joiners, BOM
    .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
    .trim()
}

/**
 * Truncate address for display. Default 6+4 for mints.
 */
export function truncateAddress(
  addr: string | null | undefined,
  startChars = 6,
  endChars = 4
): string {
  if (!addr) return ''
  if (addr.length <= startChars + endChars) return addr
  return `${addr.slice(0, startChars)}...${addr.slice(-endChars)}`
}

/**
 * Escrow price: program stores human-readable per-unit price (request tokens per 1 deposit unit).
 * Use as-is. Do not scale by decimals or any other factor.
 */
export function escrowPriceToHuman(price: number | string | null | undefined): number {
  const n = Number(price)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}
