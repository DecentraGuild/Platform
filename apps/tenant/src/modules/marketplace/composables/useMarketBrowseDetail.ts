/**
 * Detail panel state: resolve detail asset from mint, traits, filtered trades, and actions.
 * Used by MarketBrowseView; detailMint is controlled by parent (prop).
 */
import type { Ref } from 'vue'
import { computed } from 'vue'
import type { MarketplaceSettings } from '@decentraguild/core'
import { normaliseAttributes } from '~/utils/nftFilterHelpers'
import { getMarketplaceAssetFromSettings } from '~/utils/mintFromSettings'
import type { MarketplaceAsset } from '~/composables/useMarketplaceAssets'
import { useExplorerLinks } from '~/composables/useExplorerLinks'

/** Minimal escrow shape for eligibility check. */
interface EscrowForEligibility {
  account: {
    onlyRecipient: boolean
    onlyWhitelist: boolean
    recipient: { toBase58: () => string }
  }
}

export interface UseMarketBrowseDetailOptions {
  detailMint: Ref<string | null>
  assets: Ref<MarketplaceAsset[]>
  marketplaceSettings: Ref<MarketplaceSettings | null>
  /** Map of mint -> { offerTrades, requestTrades } from useEscrowsForMints. */
  byMint: Ref<Map<string, { offerTrades: unknown[]; requestTrades: unknown[] }>>
  walletAddress: Ref<string | null>
}

const SYSTEM_PROGRAM = '11111111111111111111111111111111'

function isEscrowEligibleToFill(e: EscrowForEligibility, wallet: string | null): boolean {
  if (e.account.onlyWhitelist) return false
  if (!e.account.onlyRecipient) return true
  const rec = e.account.recipient.toBase58()
  if (rec === SYSTEM_PROGRAM) return true
  return wallet !== null && rec === wallet
}

export function useMarketBrowseDetail(options: UseMarketBrowseDetailOptions) {
  const { detailMint, assets, marketplaceSettings, byMint, walletAddress } = options
  const { tokenUrl } = useExplorerLinks()

  const detailAsset = computed(() => {
    if (!detailMint.value) return null
    const fromApi = assets.value.find((a) => a.mint === detailMint.value)
    if (fromApi) return fromApi
    return getMarketplaceAssetFromSettings(detailMint.value, marketplaceSettings.value)
  })

  const detailTraits = computed(() => {
    const asset = detailAsset.value
    if (!asset?.metadata?.traits) return []
    return normaliseAttributes(asset.metadata.traits)
  })

  const detailTrades = computed(() => {
    const m = detailMint.value
    if (!m) return { offerTrades: [], requestTrades: [] }
    return byMint.value.get(m) ?? { offerTrades: [], requestTrades: [] }
  })

  const detailTradesFiltered = computed(() => {
    const raw = detailTrades.value
    const wallet = walletAddress.value
    const filter = (list: unknown[]) =>
      (list as EscrowForEligibility[]).filter((e) => isEscrowEligibleToFill(e, wallet))
    return {
      offerTrades: filter(raw.offerTrades),
      requestTrades: filter(raw.requestTrades),
    }
  })

  const solscanTokenUrl = computed(() =>
    detailMint.value ? tokenUrl(detailMint.value) : '#'
  )

  function copyDetailMint() {
    if (!detailMint.value) return
    void navigator.clipboard.writeText(detailMint.value)
  }

  return {
    detailAsset,
    detailTraits,
    detailTradesFiltered,
    solscanTokenUrl,
    copyDetailMint,
  }
}
