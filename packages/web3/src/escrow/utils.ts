import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export function toPublicKey(value: PublicKey | string, errorMessage = 'Invalid PublicKey'): PublicKey {
  if (value instanceof PublicKey) return value
  if (!value || typeof value !== 'string') throw new Error(errorMessage)
  try {
    return new PublicKey(value)
  } catch (err) {
    throw new Error(`${errorMessage}: ${(err as Error).message}`, { cause: err })
  }
}

export function toBN(
  value: BN | string | number | bigint | Uint8Array | number[],
  errorMessage = 'Invalid BN value'
): BN {
  if (value instanceof BN) return value
  if (value === null || value === undefined) throw new Error(errorMessage)
  try {
    if (value instanceof Uint8Array || Array.isArray(value)) return new BN(value)
    if (typeof value === 'bigint') return new BN(value.toString())
    return new BN(String(value))
  } catch (err) {
    throw new Error(`${errorMessage}: ${(err as Error).message}`, { cause: err })
  }
}
