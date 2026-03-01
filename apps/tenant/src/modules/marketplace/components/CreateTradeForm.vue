<template>
  <div v-if="rpcError" class="create-trade-form__error">
    <p>{{ rpcError }}</p>
    <p class="create-trade-form__hint">Add NUXT_PUBLIC_HELIUS_RPC to your .env or deploy environment.</p>
  </div>
  <div v-else>
    <p class="create-trade-form__hint">Select what you offer from your wallet and what you want in return.</p>

    <div class="create-trade-form__field">
      <label class="create-trade-form__label">Offer (from wallet)</label>
      <Select
        v-model="selectedDepositKey"
        :option-groups="depositSelectOptionGroups"
        placeholder="Select token to offer..."
        :disabled="loadingBalances"
      />
      <p v-if="scopeLoading" class="create-trade-form__field-hint">Loading store scope...</p>
      <p v-else-if="loadingBalances" class="create-trade-form__field-hint">Loading wallet balances...</p>
      <p v-else-if="prefillPrompt && initialOfferInWallet && selectedDepositKey !== initialOfferMint" class="create-trade-form__field-hint">
        You have this asset. Select it above to offer.
      </p>
      <p v-else-if="depositOptionCount === 0 && !loadingBalances && !scopeLoading" class="create-trade-form__field-hint">
        No tokens or NFTs from your wallet match this store.
      </p>
    </div>

    <div class="create-trade-form__field">
      <TokenAmountInput
        v-model="depositAmount"
        label="Offer amount"
        type="text"
        :placeholder="selectedDepositBalance ? `Max: ${formatUiAmount(selectedDepositBalance.uiAmount, selectedDepositBalance.decimals)}` : '0'"
        :show-quick-amounts="isOfferFungible && (selectedDepositBalance?.uiAmount ?? 0) > 0"
        :hint="selectedDepositBalance && isOfferFungible ? `Balance: ${formatUiAmount(selectedDepositBalance.uiAmount, selectedDepositBalance.decimals)}` : undefined"
        @set-percent="setDepositPercent"
      />
    </div>

    <div class="create-trade-form__field">
      <label class="create-trade-form__label">Request (what you want)</label>
      <Select
        v-model="requestMint"
        :option-groups="requestSelectOptionGroups"
        placeholder="Select token you want..."
      />
      <div v-if="isRequestCollection && requestMint" class="create-trade-form__nft-pick">
        <button type="button" class="create-trade-form__nft-pick-btn" @click="nftSelectorOpen = true">
          Select specific NFT from collection
        </button>
        <span v-if="requestNftName" class="create-trade-form__nft-pick-name">{{ requestNftName }}</span>
      </div>
    </div>
    <NftInstanceSelectorModal
      v-model="nftSelectorOpen"
      :collection-mint="isRequestCollection ? requestMint : null"
      :collection-name="requestCollectionName"
      :slug="tenantSlugRef"
      @select="onRequestNftSelect"
    />

    <TextInput
      v-model="requestAmount"
      type="text"
      label="Request amount"
      placeholder="Amount or price per unit"
    />

    <div class="create-trade-form__settings">
      <button
        type="button"
        class="create-trade-form__settings-toggle"
        @click="settingsExpanded = !settingsExpanded"
      >
        <Icon icon="mdi:cog" class="create-trade-form__settings-icon" />
        <span>Additional settings</span>
        <Icon :icon="settingsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
      </button>
      <div v-if="settingsExpanded" class="create-trade-form__settings-body">
        <div class="create-trade-form__settings-row">
          <div class="create-trade-form__settings-label">
            <p class="create-trade-form__settings-title">Direct</p>
            <p class="create-trade-form__settings-hint">Only this wallet can fill the trade.</p>
          </div>
          <Toggle v-model="settingsDirect" />
        </div>
        <div v-if="settingsDirect" class="create-trade-form__settings-field">
          <label class="create-trade-form__settings-field-label">Counterparty address</label>
          <TextInput
            v-model="settingsDirectAddress"
            type="text"
            placeholder="Enter Solana wallet address"
          />
        </div>
        <div class="create-trade-form__settings-row create-trade-form__settings-row--disabled">
          <div class="create-trade-form__settings-label">
            <p class="create-trade-form__settings-title">Whitelist</p>
            <p class="create-trade-form__settings-hint">Coming soon – only addresses on whitelist can fill.</p>
          </div>
          <Toggle :model-value="false" disabled />
        </div>
        <div class="create-trade-form__settings-row">
          <div class="create-trade-form__settings-label">
            <p class="create-trade-form__settings-title">Expire</p>
            <p class="create-trade-form__settings-hint">Set expiration time (UTC).</p>
          </div>
          <Toggle v-model="settingsExpire" />
        </div>
        <div v-if="settingsExpire" class="create-trade-form__settings-field">
          <div class="create-trade-form__expire-presets">
            <button
              v-for="preset in expirePresets"
              :key="preset.label"
              type="button"
              class="create-trade-form__preset-btn"
              @click="applyExpirePreset(preset.minutes)"
            >
              {{ preset.label }}
            </button>
          </div>
          <input
            v-model="settingsExpireDate"
            type="datetime-local"
            class="create-trade-form__datetime-input"
            :min="minExpireDateTime"
          />
        </div>
        <div class="create-trade-form__settings-row">
          <div class="create-trade-form__settings-label">
            <p class="create-trade-form__settings-title">Partial fill</p>
            <p class="create-trade-form__settings-hint">Allow filling part of the order.</p>
          </div>
          <Toggle v-model="settingsPartialFill" />
        </div>
        <div v-if="settingsPartialFill" class="create-trade-form__settings-row">
          <div class="create-trade-form__settings-label">
            <p class="create-trade-form__settings-title">Slippage</p>
            <p class="create-trade-form__settings-hint">milli% (1 = 0.001%).</p>
          </div>
          <input
            v-model.number="settingsSlippage"
            type="number"
            min="0"
            max="10000"
            class="create-trade-form__slippage-input"
          />
        </div>
      </div>
    </div>

    <div class="create-trade-form__actions">
      <Button variant="primary" :disabled="creating || !canCreate" @click="create">
        {{ creating ? 'Creating...' : 'Create escrow' }}
      </Button>
      <p v-if="createError" class="create-trade-form__error">{{ createError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TextInput, Button, Select, Toggle, TokenAmountInput } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import NftInstanceSelectorModal from './NftInstanceSelectorModal.vue'
import { storeToRefs } from 'pinia'
import { useAuth } from '@decentraguild/auth'
import { useTenantStore } from '~/stores/tenant'
import {
  buildInitializeTransaction,
  sendAndConfirmTransaction,
  getEscrowWalletFromConnector,
  deriveEscrowAccounts,
} from '@decentraguild/web3'
import { ESCROW_PROGRAM_ID, SLIPPAGE_DIVISOR } from '@decentraguild/contracts'
import { toRawUnits, sanitizeTokenLabel } from '@decentraguild/display'
import { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { fetchWalletTokenBalances, type TokenBalance } from '~/composables/useWalletTokenBalances'
import { useRpc } from '~/composables/useRpc'
import { useMintMetadata } from '~/composables/useMintMetadata'
import { useMarketplaceScope } from '~/composables/useMarketplaceScope'

const props = withDefaults(
  defineProps<{
    initialOfferMint?: string | null
    initialOfferType?: string | null
    initialRequestMint?: string | null
  }>(),
  {
    initialOfferMint: null,
    initialOfferType: null,
    initialRequestMint: null,
  }
)

const emit = defineEmits<{ success: [] }>()
const tenantStore = useTenantStore()
const { slug: tenantSlugRef } = storeToRefs(tenantStore)
const router = useRouter()

const { entries: scopeEntries, loading: scopeLoading } = useMarketplaceScope(tenantSlugRef)
const auth = useAuth()
const { rpcUrl, hasRpc, rpcError } = useRpc()
const { fetchMetadata } = useMintMetadata()

const walletAddress = computed(() => auth.connectorState.value?.account ?? null)

/** All mints in scope: currency, SPL, collection roots, and individual NFT mints (collection members). */
const allowedMints = computed(() => {
  const mints = new Set<string>()
  for (const e of scopeEntries.value) {
    mints.add(e.mint)
  }
  return mints
})

const storeTokenLabels = computed(() => {
  const settings = tenantStore.marketplaceSettings
  if (!settings) return new Map<string, string>()
  const map = new Map<string, string>()
  for (const c of settings.collectionMints ?? []) {
    map.set(c.mint, c.name ?? c.mint.slice(0, 8) + '...')
  }
  for (const c of settings.currencyMints ?? []) {
    map.set(c.mint, `${c.name} (${c.symbol})`)
  }
  for (const s of settings.splAssetMints ?? []) {
    map.set(s.mint, s.name ?? s.symbol ?? s.mint.slice(0, 8) + '...')
  }
  return map
})

const walletBalances = ref<TokenBalance[]>([])
const loadingBalances = ref(false)
const metadataByMint = ref<Map<string, { name: string; symbol: string }>>(new Map())

const selectedDepositKey = ref('')
const selectedDepositBalance = computed(() =>
  walletBalances.value.find((b) => b.mint === selectedDepositKey.value)
)
const requestMint = ref('')
const requestPickedNftMint = ref<string | null>(null)
const requestPickedNftName = ref<string | null>(null)
const nftSelectorOpen = ref(false)
const depositAmount = ref('')
const requestAmount = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)

const settingsExpanded = ref(true)
const settingsDirect = ref(false)
const settingsDirectAddress = ref('')
const settingsExpire = ref(false)
const settingsExpireDate = ref('')
const settingsPartialFill = ref(false)
const settingsSlippage = ref(1)

const SYSTEM_PROGRAM = '11111111111111111111111111111111'

const expirePresets = [
  { label: '+12h', minutes: 720 },
  { label: '+1d', minutes: 1440 },
  { label: '+3d', minutes: 4320 },
  { label: '+7d', minutes: 10080 },
  { label: '+30d', minutes: 43200 },
]

const minExpireDateTime = computed(() => {
  const now = new Date()
  const min = new Date(now.getTime() + 5 * 60 * 1000)
  return min.toISOString().slice(0, 16)
})

function applyExpirePreset(minutes: number) {
  const now = new Date()
  const future = new Date(now.getTime() + minutes * 60 * 1000)
  settingsExpireDate.value = future.toISOString().slice(0, 16)
  settingsExpire.value = true
}

function validateRecipientAddress(addr: string): { valid: boolean; pubkey?: PublicKey; error?: string } {
  const trimmed = addr?.trim()
  if (!trimmed) return { valid: false, error: 'Address required' }
  try {
    const pk = new PublicKey(trimmed)
    if (pk.toBase58() === SYSTEM_PROGRAM) {
      return { valid: false, error: 'Cannot use system program. Use a valid wallet address.' }
    }
    return { valid: true, pubkey: pk }
  } catch {
    return { valid: false, error: 'Invalid Solana address' }
  }
}

const initialOfferInWallet = computed(() => {
  if (!props.initialOfferMint) return false
  return walletBalances.value.some((b) => b.mint === props.initialOfferMint)
})

const prefillPrompt = computed(() => Boolean(props.initialOfferMint && props.initialOfferType))

const isOfferFungible = computed(() => {
  const b = selectedDepositBalance.value
  return b != null && b.decimals > 0
})

const depositSelectOptionGroups = computed(() => {
  const settings = tenantStore.marketplaceSettings
  const nft: { value: string; label: string }[] = []
  const spl: { value: string; label: string }[] = []
  const currency: { value: string; label: string }[] = []
  for (const b of walletBalances.value) {
    const meta = metadataByMint.value.get(b.mint)
    const name = sanitizeTokenLabel(meta?.name ?? storeTokenLabels.value.get(b.mint) ?? b.mint.slice(0, 8) + '...')
    const amt = formatUiAmount(b.uiAmount, b.decimals)
    const label = `${name} (${amt})`
    const entry = scopeEntries.value.find((e) => e.mint === b.mint)
    if (b.decimals > 0) {
      currency.push({ value: b.mint, label })
    } else if (entry?.collectionMint && settings) {
      const coll = settings.collectionMints?.find((c) => c.mint === entry.collectionMint)
      const collName = coll?.name ? sanitizeTokenLabel(coll.name) + ': ' : ''
      nft.push({ value: b.mint, label: collName ? `${collName}${name} (${amt})` : label })
    } else {
      spl.push({ value: b.mint, label })
    }
  }
  const sortByName = (a: { value: string; label: string }, b: { value: string; label: string }) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  nft.sort(sortByName)
  spl.sort(sortByName)
  currency.sort(sortByName)
  const groups: { groupLabel: string; options: { value: string; label: string }[] }[] = []
  if (nft.length) groups.push({ groupLabel: 'NFT', options: nft })
  if (spl.length) groups.push({ groupLabel: 'SPL', options: spl })
  if (currency.length) groups.push({ groupLabel: 'Currency', options: currency })
  return groups
})

const depositOptionCount = computed(() =>
  depositSelectOptionGroups.value.reduce((sum, g) => sum + g.options.length, 0)
)

const requestSelectOptionGroups = computed(() => {
  const settings = tenantStore.marketplaceSettings
  if (!settings) return []
  const nft: { value: string; label: string }[] = []
  const spl: { value: string; label: string }[] = []
  const currency: { value: string; label: string }[] = []
  for (const c of settings.collectionMints ?? []) {
    const name = sanitizeTokenLabel(c.name ?? c.mint.slice(0, 8) + '...')
    nft.push({ value: c.mint, label: name })
  }
  for (const c of settings.currencyMints ?? []) {
    const name = sanitizeTokenLabel(c.name ?? '')
    const sym = sanitizeTokenLabel(c.symbol ?? '')
    const display = sym ? `${name} (${sym})` : name || c.mint.slice(0, 8) + '...'
    currency.push({ value: c.mint, label: display })
  }
  for (const s of settings.splAssetMints ?? []) {
    const name = sanitizeTokenLabel(s.name ?? s.symbol ?? s.mint.slice(0, 8) + '...')
    spl.push({ value: s.mint, label: name })
  }
  const sortByName = (a: { value: string; label: string }, b: { value: string; label: string }) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  nft.sort(sortByName)
  spl.sort(sortByName)
  currency.sort(sortByName)
  const groups: { groupLabel: string; options: { value: string; label: string }[] }[] = []
  if (nft.length) groups.push({ groupLabel: 'NFT', options: nft })
  if (spl.length) groups.push({ groupLabel: 'SPL', options: spl })
  if (currency.length) groups.push({ groupLabel: 'Currency', options: currency })
  return groups
})

const collectionMints = computed(() => tenantStore.marketplaceSettings?.collectionMints?.map((c) => c.mint) ?? [])

const isRequestCollection = computed(() => {
  if (!requestMint.value) return false
  return collectionMints.value.includes(requestMint.value)
})

const requestCollectionName = computed(() => {
  if (!requestMint.value) return ''
  const c = tenantStore.marketplaceSettings?.collectionMints?.find((x) => x.mint === requestMint.value)
  return c?.name ?? ''
})

const requestNftName = computed(() => requestPickedNftName.value)

const effectiveRequestMint = computed(() => requestPickedNftMint.value ?? requestMint.value)

const canCreate = computed(() =>
  selectedDepositKey.value.trim() &&
  effectiveRequestMint.value.trim() &&
  depositAmount.value.trim() &&
  requestAmount.value.trim()
)

function onRequestNftSelect(mint: string, name?: string | null) {
  requestPickedNftMint.value = mint
  requestPickedNftName.value = name ?? null
  nftSelectorOpen.value = false
}

watch(requestMint, () => {
  requestPickedNftMint.value = null
  requestPickedNftName.value = null
})

function formatUiAmount(ui: number | null, decimals: number): string {
  if (ui === null || ui === undefined) return '0'
  if (decimals === 0) return Math.floor(ui).toString()
  return ui.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function setDepositPercent(pct: number) {
  const b = selectedDepositBalance.value
  if (!b?.uiAmount) return
  const amt = b.decimals === 0 ? Math.floor(b.uiAmount * pct) : Number((b.uiAmount * pct).toFixed(b.decimals))
  depositAmount.value = String(amt)
}

watch(
  [() => props.initialOfferMint, walletBalances],
  () => {
    if (!props.initialOfferMint || walletBalances.value.length === 0) return
    const hasIt = walletBalances.value.some((b) => b.mint === props.initialOfferMint)
    if (!hasIt) return
    selectedDepositKey.value = props.initialOfferMint
    const b = walletBalances.value.find((x) => x.mint === props.initialOfferMint)
    if (b) {
      if (b.decimals === 0) depositAmount.value = '1'
      else depositAmount.value = formatUiAmount(b.uiAmount, b.decimals)
    }
  },
  { immediate: true }
)

watch(
  [() => props.initialRequestMint],
  () => {
    if (props.initialRequestMint) requestMint.value = props.initialRequestMint
  },
  { immediate: true }
)

watch(selectedDepositKey, (mint) => {
  const b = walletBalances.value.find((x) => x.mint === mint)
  if (b?.decimals === 0 && !depositAmount.value) depositAmount.value = '1'
})

watch(
  [walletAddress, rpcUrl, allowedMints],
  async () => {
    if (!hasRpc || !walletAddress.value || allowedMints.value.size === 0) {
      walletBalances.value = []
      return
    }
    loadingBalances.value = true
    try {
      walletBalances.value = await fetchWalletTokenBalances(
        rpcUrl.value,
        walletAddress.value,
        allowedMints.value
      )
      const mints = [...new Set(walletBalances.value.map((b) => b.mint))]
      const metaMap = new Map<string, { name: string; symbol: string }>()
      for (const mint of mints) {
        const meta = await fetchMetadata(mint, true)
        if (meta) metaMap.set(mint, { name: meta.name, symbol: meta.symbol })
      }
      metadataByMint.value = metaMap
    } catch {
      walletBalances.value = []
    } finally {
      loadingBalances.value = false
    }
  },
  { immediate: true }
)

async function create() {
  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey) {
    createError.value = 'Wallet not connected'
    return
  }
  const dm = selectedDepositKey.value.trim()
  const rm = effectiveRequestMint.value.trim()
  const da = depositAmount.value.trim()
  const ra = requestAmount.value.trim()
  if (!dm || !rm || !da || !ra) {
    createError.value = 'Fill all fields'
    return
  }
  if (settingsDirect.value && settingsDirectAddress.value.trim()) {
    const recipientCheck = validateRecipientAddress(settingsDirectAddress.value)
    if (!recipientCheck.valid) {
      createError.value = recipientCheck.error ?? 'Invalid recipient'
      return
    }
  }

  creating.value = true
  createError.value = null
  try {
    const [depMeta, reqMeta] = await Promise.all([fetchMetadata(dm), fetchMetadata(rm)])
    const depDecimals = depMeta?.decimals ?? 0
    const reqDecimals = reqMeta?.decimals ?? 0
    const daNum = parseFloat(da)
    const raNum = parseFloat(ra)
    if (!Number.isFinite(daNum) || daNum <= 0 || !Number.isFinite(raNum) || raNum <= 0) {
      createError.value = 'Invalid amounts'
      creating.value = false
      return
    }
    const depositRaw = toRawUnits(daNum, depDecimals)
    const requestRaw = toRawUnits(raNum, reqDecimals)

    const connection = new Connection(rpcUrl.value)
    const seed = new BN(Date.now())
    const shopFee = tenantStore.marketplaceSettings?.shopFee
    const whitelist = tenantStore.marketplaceSettings?.whitelist
    const hasWhitelist = false

    let recipientAddr: string | null = null
    if (settingsDirect.value && settingsDirectAddress.value.trim()) {
      const v = validateRecipientAddress(settingsDirectAddress.value)
      if (v.valid && v.pubkey) recipientAddr = v.pubkey.toBase58()
    }

    const expireTimestamp =
      settingsExpire.value && settingsExpireDate.value
        ? Math.floor(new Date(settingsExpireDate.value).getTime() / 1000)
        : 0

    const slippageDecimal = (settingsSlippage.value ?? 1) / SLIPPAGE_DIVISOR

    const tx = await buildInitializeTransaction({
      maker: wallet.publicKey,
      depositTokenMint: dm,
      requestTokenMint: rm,
      depositAmount: new BN(depositRaw),
      requestAmount: new BN(requestRaw),
      seed,
      expireTimestamp,
      allowPartialFill: settingsPartialFill.value,
      onlyWhitelist: hasWhitelist,
      slippage: slippageDecimal,
      recipient: recipientAddr,
      connection,
      wallet,
      shopFee: shopFee ?? null,
      whitelistProgram: whitelist?.programId ?? null,
      whitelist: hasWhitelist ? whitelist!.account : null,
    })

    await sendAndConfirmTransaction(connection, tx, wallet, wallet.publicKey)

    const programId = new PublicKey(ESCROW_PROGRAM_ID)
    const { escrow } = deriveEscrowAccounts(wallet.publicKey, seed, programId)
    const slug = tenantStore.slug
    const query: Record<string, string> = slug
      ? { tenant: slug, tab: 'open-trades', escrow: escrow.toBase58() }
      : { tab: 'open-trades', escrow: escrow.toBase58() }
    await router.replace({ path: '/market', query })
    emit('success')
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create escrow'
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.create-trade-form__error {
  background: var(--theme-status-error, #fcc);
  color: var(--theme-text-primary, #111);
}

.create-trade-form__hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin-bottom: var(--theme-space-md);
}

.create-trade-form__field {
  margin-bottom: var(--theme-space-md);
}

.create-trade-form__label {
  display: block;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin-bottom: var(--theme-space-xs);
}

.create-trade-form__field-hint {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  margin-top: var(--theme-space-xs);
}

.create-trade-form__settings {
  margin-top: var(--theme-space-md);
  padding-top: var(--theme-space-md);
  border-top: var(--theme-border-thin) solid var(--theme-border);
}

.create-trade-form__settings-toggle {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  width: 100%;
  padding: var(--theme-space-xs) 0;
  background: none;
  border: none;
  font-size: var(--theme-font-sm);
  font-weight: 600;
  color: var(--theme-text-primary);
  cursor: pointer;
}

.create-trade-form__settings-icon {
  flex-shrink: 0;
}

.create-trade-form__settings-body {
  margin-top: var(--theme-space-sm);
  padding: var(--theme-space-md);
  background: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-md);
  border: var(--theme-border-thin) solid var(--theme-border);
}

.create-trade-form__settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--theme-space-md);
  margin-bottom: var(--theme-space-sm);
}

.create-trade-form__settings-row--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-trade-form__settings-label {
  flex: 1;
}

.create-trade-form__settings-title {
  margin: 0;
  font-size: var(--theme-font-sm);
  font-weight: 500;
  color: var(--theme-text-primary);
}

.create-trade-form__settings-hint {
  margin: 2px 0 0;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.create-trade-form__settings-field {
  margin-bottom: var(--theme-space-sm);
  margin-left: var(--theme-space-md);
}

.create-trade-form__settings-field-label {
  display: block;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  margin-bottom: var(--theme-space-xs);
}

.create-trade-form__expire-presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
  margin-bottom: var(--theme-space-xs);
}

.create-trade-form__preset-btn {
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.create-trade-form__preset-btn:hover {
  color: var(--theme-text-primary);
  border-color: var(--theme-primary);
}

.create-trade-form__datetime-input {
  width: 100%;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.create-trade-form__slippage-input {
  width: 4rem;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: var(--theme-font-sm);
  text-align: right;
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.create-trade-form__actions {
  margin-top: var(--theme-space-lg);
}

.create-trade-form__error {
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
  margin-top: var(--theme-space-sm);
}
</style>
