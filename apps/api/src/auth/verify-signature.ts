import * as ed from '@noble/ed25519'
import bs58 from 'bs58'

/**
 * Verify an Ed25519 signature from a Solana wallet.
 * wallet: base58 public key
 * message: raw UTF-8 string that was signed
 * signatureEncoded: base64- or base58-encoded signature (wallets may return either)
 */
export async function verifyWalletSignature(
  wallet: string,
  message: string,
  signatureEncoded: string
): Promise<boolean> {
  try {
    const publicKeyBytes = bs58.decode(wallet)
    if (publicKeyBytes.length !== 32) return false
    const messageBytes = new TextEncoder().encode(message)
    let signatureBytes: Uint8Array
    const base64Decoded = Buffer.from(signatureEncoded, 'base64')
    if (base64Decoded.length === 64) {
      signatureBytes = new Uint8Array(base64Decoded)
    } else {
      try {
        signatureBytes = new Uint8Array(bs58.decode(signatureEncoded))
      } catch {
        return false
      }
    }
    if (signatureBytes.length !== 64) return false
    return await ed.verifyAsync(
      signatureBytes,
      messageBytes,
      new Uint8Array(publicKeyBytes)
    )
  } catch {
    return false
  }
}
