const TTL_MS = 5 * 60 * 1000 // 5 minutes

interface NonceEntry {
  nonce: string
  expiresAt: number
}

const store = new Map<string, NonceEntry>()

function prune(): void {
  const now = Date.now()
  for (const [wallet, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(wallet)
  }
}

export function setNonce(wallet: string, nonce: string): void {
  prune()
  store.set(wallet, { nonce, expiresAt: Date.now() + TTL_MS })
}

export function consumeNonce(wallet: string, message: string): boolean {
  const entry = store.get(wallet)
  if (!entry) return false
  if (entry.expiresAt <= Date.now()) {
    store.delete(wallet)
    return false
  }
  if (entry.nonce !== message) return false
  store.delete(wallet)
  return true
}
