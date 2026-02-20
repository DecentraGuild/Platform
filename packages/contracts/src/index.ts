/**
 * Program IDs and IDLs for DecentraGuild.
 */

import escrowIdl from './idl/escrow_service.json'

export const ESCROW_PROGRAM_ID = 'esccxeEDYUXQaeMwq1ZwWAvJaHVYfsXNva13JYb2Chs' as const
export const WHITELIST_PROGRAM_ID = 'whi5uDPWK4rAE9Sus6hdxdHwsG1hjDBn6kXM6pyqwTn' as const
export const CONTRACT_FEE_ACCOUNT = 'feeLpAUDSsYBMwpxvVr5hwwDQE32BcWXRfAd3A6agWx' as const

export const ESCROW_IDL = escrowIdl as Record<string, unknown>

export const ESCROW_DEFAULTS = {
  PARTIAL_FILL: true,
  SLIPPAGE_MILLI_PERCENT: 1,
  MIN_EXPIRATION_MINUTES: 5,
} as const

export const SLIPPAGE_DIVISOR = 100000
