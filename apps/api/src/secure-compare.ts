import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison using SHA-256 hashes.
 * Avoids leaking secret length or content via timing side channels.
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  if (ha.length !== hb.length) return false
  return timingSafeEqual(ha, hb)
}
