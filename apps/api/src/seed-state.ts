/**
 * Tracks whether the initial tenant/marketplace seed has completed.
 * Seed runs fire-and-forget on startup; health can expose seedPending so operators
 * know scope may be empty until it finishes (or if the process exits first).
 */

let seedCompleted = false

export function setSeedCompleted(): void {
  seedCompleted = true
}

export function isSeedPending(): boolean {
  return !seedCompleted
}
