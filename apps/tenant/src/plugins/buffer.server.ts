/**
 * Polyfill Buffer for SSR. Solana/Anchor packages use Buffer; Vite's SSR bundle
 * may not expose Node's Buffer. Must run before any code that imports @decentraguild/web3.
 * Set at module load so it's available before plugin callbacks or any other imports.
 */
import { Buffer } from 'buffer'

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

export default defineNuxtPlugin(() => {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer
  }
})
