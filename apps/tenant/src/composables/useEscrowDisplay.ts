/**
 * Resolves escrow to human-readable display data for display and fill.
 * Deposit amount: tokensDepositRemaining is in deposit-token raw units; we use deposit-token
 * decimals from config (or 0 for NFTs/unknown mints). Request amount = depositAmount * price.
 * Request decimals from config (request mint). Price from escrow (human per-unit).
 */
import { fromRawUnits, escrowPriceToHuman, truncateAddress } from '@decentraguild/display'
import type { EscrowWithAddress } from '@decentraguild/web3'
import type { EscrowApiShape } from './useEscrowsForMints'
import { getMintInfoFromSettings } from '~/utils/mintFromSettings'

export interface EscrowDisplayData {
  depositAmount: number
  depositSymbol: string | null
  depositName: string | null
  depositMintShort: string
  depositDecimals: number
  requestAmount: number
  requestSymbol: string | null
  requestName: string | null
  requestMintShort: string
  requestDecimals: number
  pricePerUnit: number
  priceSymbol: string | null
  loading: boolean
}

function toMintStr(e: EscrowWithAddress | EscrowApiShape, side: 'deposit' | 'request'): string {
  if ('publicKey' in e && 'account' in e) {
    const acc = (e as EscrowWithAddress).account
    return (side === 'deposit' ? acc.depositToken : acc.requestToken).toBase58()
  }
  const acc = (e as EscrowApiShape).account
  return side === 'deposit' ? acc.depositToken : acc.requestToken
}

function getRemaining(e: EscrowWithAddress | EscrowApiShape): string | { toString: () => string } {
  const acc = (e as EscrowWithAddress).account ?? (e as EscrowApiShape).account
  const rem = acc.tokensDepositRemaining
  return rem
}

function getPrice(e: EscrowWithAddress | EscrowApiShape): number {
  const acc = (e as EscrowWithAddress).account ?? (e as EscrowApiShape).account
  return escrowPriceToHuman(acc.price)
}

function getDecimalsFromConfig(
  mint: string,
  settings: import('@decentraguild/core').MarketplaceSettings | null
): number {
  const info = getMintInfoFromSettings(mint, settings)
  return Math.max(0, Math.min(18, info.decimals))
}

export function useEscrowDisplay(escrow: Ref<EscrowWithAddress | EscrowApiShape | null>) {
  const tenantStore = useTenantStore()
  const { fetchMetadata } = useMintMetadata()

  const depositMeta = ref<{ name: string; symbol: string } | null>(null)
  const requestMeta = ref<{ name: string; symbol: string } | null>(null)
  const loading = ref(true)

  const data = computed<EscrowDisplayData | null>(() => {
    const e = escrow.value
    if (!e) return null

    const depositMint = toMintStr(e, 'deposit')
    const requestMint = toMintStr(e, 'request')
    const settings = tenantStore.marketplaceSettings

    const depositDecimalsFromConfig = getDecimalsFromConfig(depositMint, settings)
    const requestDecimalsFromConfig = getDecimalsFromConfig(requestMint, settings)
    const depositDecimalsSafe = Math.max(0, Math.min(18, depositDecimalsFromConfig))
    const requestDecimalsSafe = requestDecimalsFromConfig

    const remaining = getRemaining(e)
    const depositAmount = fromRawUnits(remaining, depositDecimalsSafe)
    const pricePerUnit = getPrice(e)
    const requestAmount = depositAmount * pricePerUnit

    return {
      depositAmount,
      depositSymbol: depositMeta.value?.symbol ?? null,
      depositName: depositMeta.value?.name ?? null,
      depositMintShort: truncateAddress(depositMint, 6, 4),
      depositDecimals: depositDecimalsSafe,
      requestAmount,
      requestSymbol: requestMeta.value?.symbol ?? null,
      requestName: requestMeta.value?.name ?? null,
      requestMintShort: truncateAddress(requestMint, 6, 4),
      requestDecimals: requestDecimalsSafe,
      pricePerUnit,
      priceSymbol: requestMeta.value?.symbol ?? null,
      loading: loading.value,
    }
  })

  async function load() {
    const e = escrow.value
    if (!e) {
      loading.value = false
      return
    }
    loading.value = true
    const depositMint = toMintStr(e, 'deposit')
    const requestMint = toMintStr(e, 'request')
    try {
      const [dep, req] = await Promise.all([fetchMetadata(depositMint), fetchMetadata(requestMint)])
      depositMeta.value = dep ? { name: dep.name, symbol: dep.symbol } : null
      requestMeta.value = req ? { name: req.name, symbol: req.symbol } : null
    } finally {
      loading.value = false
    }
  }

  watch(escrow, load, { immediate: true })

  return { data, load }
}
