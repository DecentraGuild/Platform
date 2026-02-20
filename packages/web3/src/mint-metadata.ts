/**
 * Fetch mint metadata from Solana chain.
 * Used by API and tenant app (client-side fallback when API returns 404).
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { getMint } from '@solana/spl-token'

const TOKEN_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'

function getMetadataPDA(mintAddress: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      new PublicKey(TOKEN_METADATA_PROGRAM_ID).toBuffer(),
      new PublicKey(mintAddress).toBuffer(),
    ],
    new PublicKey(TOKEN_METADATA_PROGRAM_ID)
  )
  return pda
}

function cleanString(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = s.trim()
  return t.length > 0 ? t : null
}

export interface FetchedMintMetadata {
  mint: string
  name: string | null
  symbol: string | null
  image: string | null
  decimals: number | null
  sellerFeeBasisPoints: number | null
}

/**
 * Fetch token metadata from chain (decimals from mint account, name/symbol/image from Metaplex).
 */
export async function fetchMintMetadataFromChain(
  connection: Connection,
  mintAddress: string
): Promise<FetchedMintMetadata> {
  const result: FetchedMintMetadata = {
    mint: mintAddress,
    name: null,
    symbol: null,
    image: null,
    decimals: null,
    sellerFeeBasisPoints: null,
  }

  try {
    const mintPubkey = new PublicKey(mintAddress)
    const mintInfo = await getMint(connection, mintPubkey)
    result.decimals = mintInfo.decimals
  } catch {
    // Mint may not exist or not be SPL
  }

  try {
    const metadataPDA = getMetadataPDA(mintAddress)
    const accountInfo = await connection.getAccountInfo(metadataPDA)
    if (!accountInfo?.data) return result

    const data = accountInfo.data
    let offset = 1 + 32 + 32

    if (offset + 4 > data.length) return result
    const nameLen = data.readUInt32LE(offset)
    offset += 4
    if (offset + nameLen > data.length) return result
    result.name = cleanString(data.subarray(offset, offset + nameLen).toString('utf8'))
    offset += nameLen

    if (offset + 4 > data.length) return result
    const symbolLen = data.readUInt32LE(offset)
    offset += 4
    if (offset + symbolLen > data.length) return result
    result.symbol = cleanString(data.subarray(offset, offset + symbolLen).toString('utf8'))
    offset += symbolLen

    if (offset + 4 > data.length) return result
    const uriLen = data.readUInt32LE(offset)
    offset += 4
    if (offset + uriLen <= data.length && uriLen > 0) {
      const uri = data.subarray(offset, offset + uriLen).toString('utf8').trim()
      if (uri && !uri.startsWith('http://localhost')) {
        try {
          let metadataUrl = uri
          if (uri.startsWith('ipfs://')) {
            metadataUrl = `https://ipfs.io/ipfs/${uri.replace('ipfs://', '').replace(/^\/+/, '')}`
          } else if (uri.startsWith('ar://')) {
            metadataUrl = `https://arweave.net/${uri.replace('ar://', '').replace(/^\/+/, '')}`
          }
          const ctrl = new AbortController()
          const t = setTimeout(() => ctrl.abort(), 2500)
          const res = await fetch(metadataUrl, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
          clearTimeout(t)
          if (res.ok) {
            const ct = res.headers.get('content-type')
            if (ct?.includes('application/json')) {
              const json = (await res.json()) as {
                image?: string
                image_uri?: string
                seller_fee_basis_points?: number
              }
              let img = json.image ?? json.image_uri ?? null
              if (img?.startsWith('ipfs://')) {
                img = `https://ipfs.io/ipfs/${img.replace('ipfs://', '').replace(/^\/+/, '')}`
              } else if (img?.startsWith('ar://')) {
                img = `https://arweave.net/${img.replace('ar://', '').replace(/^\/+/, '')}`
              }
              result.image = img
              const bps = json.seller_fee_basis_points
              result.sellerFeeBasisPoints =
                typeof bps === 'number' && bps >= 0 && bps <= 10000 ? bps : null
            }
          }
        } catch {
          // Ignore fetch errors
        }
      }
    }
  } catch {
    // No Metaplex metadata
  }

  return result
}
