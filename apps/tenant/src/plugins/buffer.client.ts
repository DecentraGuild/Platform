/**
 * Polyfill Buffer for Solana packages (@solana/spl-token etc) that expect Node's Buffer.
 * Must run before any page that imports @decentraguild/web3.
 */
import { Buffer } from 'buffer'
export default defineNuxtPlugin(() => {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer
  }
})
