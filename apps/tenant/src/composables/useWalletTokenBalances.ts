/**
 * Fetch connected wallet's token balances, filtered by allowed mints.
 * Uses getParsedTokenAccountsByOwner (Token + Token-2022) like C2C - RPC is reliable for USDC, USDT.
 * Adds native SOL when WSOL is in allowed mints (user can wrap). Client cache: 60s.
 */
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112'
const BALANCE_CACHE_TTL_MS = 60_000

export interface TokenBalance {
  mint: string
  amount: string
  decimals: number
  uiAmount: number | null
}

const balanceCache = new Map<
  string,
  { balances: TokenBalance[]; fetchedAt: number }
>()

function getCacheKey(rpcUrl: string, owner: string): string {
  return `${rpcUrl}:${owner}`
}

function getCached(rpcUrl: string, owner: string): TokenBalance[] | null {
  const key = getCacheKey(rpcUrl, owner)
  const hit = balanceCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.fetchedAt > BALANCE_CACHE_TTL_MS) {
    balanceCache.delete(key)
    return null
  }
  return hit.balances
}

function setCache(rpcUrl: string, owner: string, balances: TokenBalance[]) {
  balanceCache.set(getCacheKey(rpcUrl, owner), {
    balances,
    fetchedAt: Date.now(),
  })
}

export async function fetchWalletTokenBalances(
  rpcUrl: string,
  ownerAddress: string,
  allowedMints: Set<string>,
  options?: { forceRefresh?: boolean }
): Promise<TokenBalance[]> {
  if (allowedMints.size === 0) return []

  if (!options?.forceRefresh) {
    const cached = getCached(rpcUrl, ownerAddress)
    if (cached) return cached
  }

  const connection = new Connection(rpcUrl)
  const owner = new PublicKey(ownerAddress)
  const result: TokenBalance[] = []

  const [standardAccounts, token2022Accounts] = await Promise.all([
    connection
      .getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })
      .catch(() => ({ value: [] })),
    connection
      .getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID })
      .catch(() => ({ value: [] })),
  ])

  const allAccounts = [
    ...(standardAccounts.value ?? []),
    ...(token2022Accounts.value ?? []),
  ]

  const seenMints = new Set<string>()
  for (const acc of allAccounts) {
    const mint = acc.account.data.parsed?.info?.mint
    if (!mint || !allowedMints.has(mint) || seenMints.has(mint)) continue
    const amount = acc.account.data.parsed?.info?.tokenAmount
    if (!amount) continue
    seenMints.add(mint)
    result.push({
      mint,
      amount: amount.amount,
      decimals: amount.decimals ?? 0,
      uiAmount: amount.uiAmount ?? null,
    })
  }

  if (allowedMints.has(NATIVE_SOL_MINT)) {
    try {
      const lamports = await connection.getBalance(owner)
      const solBalance = lamports / 1e9
      if (solBalance > 0 || !seenMints.has(NATIVE_SOL_MINT)) {
        result.push({
          mint: NATIVE_SOL_MINT,
          amount: lamports.toString(),
          decimals: 9,
          uiAmount: solBalance,
        })
      }
    } catch {
      // ignore
    }
  }

  setCache(rpcUrl, ownerAddress, result)
  return result
}
