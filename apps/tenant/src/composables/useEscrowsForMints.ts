/**
 * Fetches escrows and groups them by mint: offerTrades (depositToken) and requestTrades (requestToken).
 * Prefers API when apiUrl and slug available (no client RPC needed); falls back to client RPC.
 * Only includes escrows where BOTH sides are in scope and have meaningful remaining (not completed).
 */
import { Connection, PublicKey } from '@solana/web3.js'
import { API_V1 } from '~/utils/apiBase'
import BN from 'bn.js'
import { escrowPriceToHuman } from '@decentraguild/display'
import { fetchAllEscrows } from '@decentraguild/web3'
import type { EscrowWithAddress } from '@decentraguild/web3'

const MIN_REMAINING_HUMAN = 0.0000001

function isEffectivelyComplete(remaining: BN, decimals: number): boolean {
  const rawThreshold = Math.max(1, Math.round(MIN_REMAINING_HUMAN * 10 ** decimals))
  return remaining.lt(new BN(rawThreshold))
}

export interface EscrowApiShape {
  publicKey: string
  account: {
    maker: string
    depositToken: string
    requestToken: string
    tokensDepositInit: string
    tokensDepositRemaining: string
    price: number
    decimals: number
    slippage: number
    seed: string
    expireTimestamp: string
    recipient: string
    onlyRecipient: boolean
    onlyWhitelist: boolean
    allowPartialFill: boolean
    whitelist: string
  }
}

export interface TradesByMint {
  offerTrades: EscrowWithAddress[]
  requestTrades: EscrowWithAddress[]
}

function apiEscrowToFull(e: EscrowApiShape): EscrowWithAddress {
  const acc = e.account
  return {
    publicKey: new PublicKey(e.publicKey),
    account: {
      maker: new PublicKey(acc.maker),
      depositToken: new PublicKey(acc.depositToken),
      requestToken: new PublicKey(acc.requestToken),
      tokensDepositInit: new BN(acc.tokensDepositInit),
      tokensDepositRemaining: new BN(acc.tokensDepositRemaining),
      price: escrowPriceToHuman(acc.price),
      decimals: acc.decimals,
      slippage: acc.slippage,
      seed: new BN(acc.seed),
      authBump: 0,
      vaultBump: 0,
      escrowBump: 0,
      expireTimestamp: new BN(acc.expireTimestamp),
      recipient: new PublicKey(acc.recipient),
      onlyRecipient: acc.onlyRecipient,
      onlyWhitelist: acc.onlyWhitelist,
      allowPartialFill: acc.allowPartialFill,
      whitelist: new PublicKey(acc.whitelist),
    },
  }
}

export function useEscrowsForMints(
  mints: Ref<Set<string>>,
  rpcUrl: Ref<string>,
  options?: { apiUrl?: Ref<string>; slug?: Ref<string | null> }
) {
  const escrows = ref<EscrowWithAddress[]>([])
  const byMint = computed(() => {
    const map = new Map<string, TradesByMint>()
    const list = escrows.value
    const m = mints.value

    for (const e of list) {
      const dep = e.account.depositToken.toBase58()
      const req = e.account.requestToken.toBase58()

      if (m.has(dep)) {
        let entry = map.get(dep)
        if (!entry) {
          entry = { offerTrades: [], requestTrades: [] }
          map.set(dep, entry)
        }
        entry.offerTrades.push(e)
      }
      if (m.has(req)) {
        let entry = map.get(req)
        if (!entry) {
          entry = { offerTrades: [], requestTrades: [] }
          map.set(req, entry)
        }
        entry.requestTrades.push(e)
      }
    }
    return map
  })

  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const apiBase = options?.apiUrl?.value ?? ''
    const slug = options?.slug?.value
    const useApi = apiBase && slug && apiBase.length > 0

    if (useApi) {
      loading.value = true
      error.value = null
      try {
        const res = await fetch(`${apiBase}${API_V1}/tenant/${encodeURIComponent(slug)}/marketplace/escrows`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { escrows?: EscrowApiShape[] }
        const raw = Array.isArray(data.escrows) ? data.escrows : []
        escrows.value = raw.map(apiEscrowToFull)
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load escrows'
        escrows.value = []
      } finally {
        loading.value = false
      }
      return
    }

    if (!rpcUrl.value) {
      error.value = 'RPC URL not configured'
      return
    }
    loading.value = true
    error.value = null
    try {
      const connection = new Connection(rpcUrl.value)
      const all = await fetchAllEscrows(connection)
      const m = mints.value
      escrows.value = all.filter((e) => {
        const dep = e.account.depositToken.toBase58()
        const req = e.account.requestToken.toBase58()
        const bothInScope = m.has(dep) && m.has(req)
        const notComplete = !isEffectivelyComplete(
          e.account.tokensDepositRemaining,
          e.account.decimals
        )
        return bothInScope && notComplete
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load escrows'
      escrows.value = []
    } finally {
      loading.value = false
    }
  }

  return { escrows, byMint, loading, error, retry: load }
}
