/**
 * Fetch mint metadata from API (cached). If API returns 404, falls back to client-side RPC fetch.
 */
import { Connection } from '@solana/web3.js'
import { fetchMintMetadataFromChain } from '@decentraguild/web3'

export interface MintMetadata {
  mint: string
  name: string
  symbol: string
  image?: string | null
  decimals: number
}

const cache = new Map<string, MintMetadata>()

function fromFetched(f: { mint: string; name: string | null; symbol: string | null; image: string | null; decimals: number | null }): MintMetadata {
  return {
    mint: f.mint,
    name: f.name ?? '',
    symbol: f.symbol ?? '',
    image: f.image ?? null,
    decimals: f.decimals ?? 0,
  }
}

export function useMintMetadata() {
  const apiBase = useApiBase()

  async function fetchMetadata(mint: string, forceFromChain = false): Promise<MintMetadata | null> {
    const key = mint
    const cached = cache.get(key)
    if (cached && !forceFromChain) return cached

    if (!forceFromChain && apiBase.value) {
      const url = `${apiBase.value}/api/v1/marketplace/metadata/mint/${encodeURIComponent(mint)}`
      try {
        const res = await fetch(url)
        if (res.ok) {
          const data = (await res.json()) as MintMetadata
          cache.set(key, data)
          return data
        }
      } catch {
        // Fall through to RPC
      }
    }

    const { rpcUrl } = useRpc()
    if (!rpcUrl.value) return null
    try {
      const connection = new Connection(rpcUrl.value)
      const fetched = await fetchMintMetadataFromChain(connection, mint)
      const data = fromFetched(fetched)
      cache.set(key, data)
      return data
    } catch {
      return null
    }
  }

  return { fetchMetadata }
}
