<template>
  <div class="marketplace-settings">
    <Card>
      <h3>NFT collections</h3>
      <p class="marketplace-settings__hint">Collection mint addresses. Each collection is expanded via DAS into individual NFTs.</p>
      <div class="marketplace-settings__add-mint">
        <TextInput
          v-model="newCollectionMint"
          placeholder="Collection mint (e.g. CL2m6...)"
          :error="addCollectionError"
          @keydown.enter.prevent="addCollection"
        />
        <Button variant="secondary" :disabled="!newCollectionMint.trim() || saving" @click="addCollection">
          Add
        </Button>
      </div>
      <ul v-if="form.collectionMints.length" class="marketplace-settings__mint-list">
        <li
          v-for="(item, idx) in form.collectionMints"
          :key="item.mint"
          class="marketplace-settings__mint-item marketplace-settings__mint-item--clickable"
        >
          <button
            type="button"
            class="marketplace-settings__mint-row"
            :disabled="!!item._loading || !!item._error"
            @click="openCollectionDetail(item)"
          >
            <div class="marketplace-settings__mint-thumb">
              <img v-if="item.image" :src="item.image" :alt="item.name ?? item.mint" />
              <span v-else class="marketplace-settings__mint-thumb-placeholder"><Icon icon="mdi:image-off" /></span>
            </div>
            <div class="marketplace-settings__mint-detail">
              <template v-if="item._loading">
                <Icon icon="mdi:loading" class="marketplace-settings__spinner" />
                <span class="marketplace-settings__mint-name">{{ item.mint.slice(0, 8) + '...' + item.mint.slice(-4) }}</span>
                <span class="marketplace-settings__mint-status">Loading...</span>
              </template>
              <template v-else-if="item._error">
                <span class="marketplace-settings__mint-name">{{ item.mint.slice(0, 8) + '...' }}</span>
                <span class="marketplace-settings__mint-error">{{ item._error }}</span>
              </template>
              <template v-else>
                <span class="marketplace-settings__mint-name">{{ item.name || item.mint.slice(0, 8) + '...' }}</span>
                <code class="marketplace-settings__mint-address">{{ item.mint.slice(0, 8) }}...{{ item.mint.slice(-6) }}</code>
                <span class="marketplace-settings__mint-meta">
                  {{ item.collectionSize ?? 0 }} NFTs, {{ item.uniqueTraitCount ?? 0 }} trait types
                  <span v-if="item.sellerFeeBasisPoints != null"> · {{ item.sellerFeeBasisPoints }} bps</span>
                  <span v-if="(item.traitTypes?.length ?? 0) > 0" class="marketplace-settings__traits-hint">
                    ({{ item.traitTypes!.slice(0, 3).join(', ') }}{{ (item.traitTypes!.length ?? 0) > 3 ? '...' : '' }})
                  </span>
                </span>
              </template>
            </div>
          </button>
          <Button variant="ghost" :disabled="!!item._loading" @click.stop="removeCollection(idx)">
            <Icon icon="mdi:close" />
          </Button>
        </li>
      </ul>
      <p v-else class="marketplace-settings__empty">No NFT collections. Add a collection mint above.</p>
    </Card>

    <Card>
      <h3>SPL assets</h3>
      <p class="marketplace-settings__hint">Individual SPL token mints (one mint = one asset).</p>
      <div class="marketplace-settings__add-mint">
        <TextInput
          v-model="newSplMint"
          placeholder="Mint address"
          :error="addSplError"
          @keydown.enter.prevent="addSpl"
        />
        <Button variant="secondary" :disabled="!newSplMint.trim() || saving" @click="addSpl">
          Add
        </Button>
      </div>
      <ul v-if="form.splAssetMints.length" class="marketplace-settings__mint-list">
        <li
          v-for="(item, idx) in form.splAssetMints"
          :key="item.mint"
          class="marketplace-settings__mint-item"
        >
          <div class="marketplace-settings__mint-row marketplace-settings__mint-row--plain">
            <div class="marketplace-settings__mint-thumb">
              <img v-if="item.image" :src="item.image" :alt="item.name ?? item.symbol ?? item.mint" />
              <span v-else class="marketplace-settings__mint-thumb-placeholder"><Icon icon="mdi:token" /></span>
            </div>
            <div class="marketplace-settings__mint-detail">
              <template v-if="item._loading">
                <Icon icon="mdi:loading" class="marketplace-settings__spinner" />
                <span class="marketplace-settings__mint-name">{{ item.mint.slice(0, 8) + '...' + item.mint.slice(-4) }}</span>
                <span class="marketplace-settings__mint-status">Loading...</span>
              </template>
              <template v-else-if="item._error">
                <span class="marketplace-settings__mint-name">{{ item.mint.slice(0, 8) + '...' + item.mint.slice(-4) }}</span>
                <span class="marketplace-settings__mint-error">{{ item._error }}</span>
              </template>
              <template v-else>
                <span class="marketplace-settings__mint-name">{{ (item.symbol || item.name) || item.mint.slice(0, 8) + '...' }}</span>
                <code class="marketplace-settings__mint-address">{{ item.mint.slice(0, 8) }}...{{ item.mint.slice(-6) }}</code>
                <span class="marketplace-settings__mint-meta">
                  {{ item.name || '' }} {{ item.decimals != null ? `· ${item.decimals} dec` : '' }}
                  {{ item.sellerFeeBasisPoints != null ? `· ${item.sellerFeeBasisPoints} bps` : '' }}
                </span>
              </template>
            </div>
          </div>
          <Button variant="ghost" :disabled="!!item._loading" @click="removeSpl(idx)">
            <Icon icon="mdi:close" />
          </Button>
        </li>
      </ul>
      <p v-else class="marketplace-settings__empty">No SPL assets. Add a mint above.</p>
    </Card>

    <Card>
      <h3>Currencies</h3>
      <p class="marketplace-settings__hint">Base: SOL, WBTC, USDC, USDT. Add custom by mint.</p>
      <div class="marketplace-settings__base-toggles">
        <label v-for="b in BASE_CURRENCIES" :key="b.symbol" class="marketplace-settings__checkbox">
          <input
            :checked="form.currencyMints.some((c) => c.mint === b.mint)"
            type="checkbox"
            @change="onBaseToggle(b.symbol, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ b.symbol }}</span>
        </label>
      </div>
      <div class="marketplace-settings__custom">
        <p class="marketplace-settings__hint">Custom currencies</p>
        <div class="marketplace-settings__add-mint">
          <TextInput
            v-model="newCurrencyMint"
            placeholder="Mint address"
            :error="addCurrencyError"
            @keydown.enter.prevent="lookupAndAddCurrency"
          />
          <Button
            variant="secondary"
            :disabled="!newCurrencyMint.trim() || saving"
            @click="lookupAndAddCurrency"
          >
            Add
          </Button>
        </div>
        <ul v-if="customCurrencies.length" class="marketplace-settings__mint-list">
          <li
            v-for="(c, idx) in customCurrencies"
            :key="c.mint"
            class="marketplace-settings__mint-item"
          >
            <div class="marketplace-settings__mint-row marketplace-settings__mint-row--plain">
              <div class="marketplace-settings__mint-thumb">
                <img v-if="c.image" :src="c.image" :alt="c.name ?? c.symbol ?? c.mint" />
                <span v-else class="marketplace-settings__mint-thumb-placeholder"><Icon icon="mdi:cash-multiple" /></span>
              </div>
              <div class="marketplace-settings__mint-detail">
                <template v-if="c._loading">
                  <Icon icon="mdi:loading" class="marketplace-settings__spinner" />
                  <span class="marketplace-settings__mint-name">{{ c.mint.slice(0, 8) + '...' + c.mint.slice(-4) }}</span>
                  <span class="marketplace-settings__mint-status">Loading...</span>
                </template>
                <template v-else-if="c._error">
                  <span class="marketplace-settings__mint-name">{{ c.mint.slice(0, 8) + '...' + c.mint.slice(-4) }}</span>
                  <span class="marketplace-settings__mint-error">{{ c._error }}</span>
                </template>
                <template v-else>
                  <span class="marketplace-settings__mint-name">{{ (c.symbol || c.name) || c.mint.slice(0, 8) + '...' }}</span>
                  <code class="marketplace-settings__mint-address">{{ c.mint.slice(0, 8) }}...{{ c.mint.slice(-6) }}</code>
                  <span class="marketplace-settings__mint-meta">
                    {{ c.name || '' }} {{ c.decimals != null ? `· ${c.decimals} dec` : '' }}
                    {{ c.sellerFeeBasisPoints != null ? `· ${c.sellerFeeBasisPoints} bps` : '' }}
                  </span>
                </template>
              </div>
            </div>
            <Button variant="ghost" :disabled="!!c._loading" @click="removeCustomCurrency(idx)">
              <Icon icon="mdi:close" />
            </Button>
          </li>
        </ul>
      </div>
    </Card>

    <Card>
      <h3>Fees</h3>
      <TextInput
        v-model="form.shopFee.wallet"
        label="Fee recipient wallet"
        placeholder="Wallet address"
      />
      <div class="marketplace-settings__fee-row">
        <TextInput
          v-model.number="form.shopFee.makerFlatFee"
          type="number"
          label="Maker flat fee (SOL)"
          placeholder="0"
        />
        <TextInput
          v-model.number="form.shopFee.takerFlatFee"
          type="number"
          label="Taker flat fee (SOL)"
          placeholder="0"
        />
      </div>
      <div class="marketplace-settings__fee-row">
        <TextInput
          v-model.number="form.shopFee.makerPercentFee"
          type="number"
          label="Maker % (basis points)"
          placeholder="0"
        />
        <TextInput
          v-model.number="form.shopFee.takerPercentFee"
          type="number"
          label="Taker % (basis points)"
          placeholder="0"
        />
      </div>
    </Card>

    <Card>
      <h3>Whitelist</h3>
      <p class="marketplace-settings__hint">Escrow program uses these for whitelist-protected trades. Empty account = no whitelist.</p>
      <TextInput
        v-model="form.whitelist.programId"
        label="Whitelist program ID"
        placeholder="whi5uDPWK4rAE9Sus6hdxdHwsG1hjDBn6kXM6pyqwTn"
      />
      <TextInput
        v-model="form.whitelist.account"
        label="Whitelist account (optional)"
        placeholder="Leave empty for public escrows"
      />
    </Card>

    <div class="marketplace-settings__actions">
      <Button
        variant="primary"
        :disabled="saving || !canSave"
        @click="save"
      >
        {{ saving ? 'Saving...' : saveSuccess ? 'Saved' : canSave ? 'Save Marketplace Settings' : 'Complete loading before saving' }}
      </Button>
      <p v-if="saveSuccess" class="marketplace-settings__success">Settings saved.</p>
      <p v-else-if="saveError" class="marketplace-settings__error">{{ saveError }}</p>
    </div>

    <AdminCollectionDetailModal
      v-model="showCollectionModal"
      :collection="selectedCollection"
      :slug="slug"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Card, TextInput, Button } from '@decentraguild/ui/components'
import AdminCollectionDetailModal from './AdminCollectionDetailModal.vue'
import { reactive, ref, watch, computed, nextTick } from 'vue'

interface CollectionMint {
  mint: string
  name?: string
  image?: string
  sellerFeeBasisPoints?: number
  groupPath?: string[]
  collectionSize?: number
  uniqueTraitCount?: number
  traitTypes?: string[]
  _loading?: boolean
  _error?: string
}

interface SplAssetMint {
  mint: string
  name?: string
  symbol?: string
  image?: string
  decimals?: number | null
  sellerFeeBasisPoints?: number | null
  _loading?: boolean
  _error?: string
}

interface CurrencyMint {
  mint: string
  name: string
  symbol: string
  image?: string
  decimals?: number | null
  sellerFeeBasisPoints?: number | null
  _loading?: boolean
  _error?: string
}

interface ShopFee {
  wallet: string
  makerFlatFee: number
  takerFlatFee: number
  makerPercentFee: number
  takerPercentFee: number
}

interface WhitelistSettings {
  programId: string
  account: string
}

const BASE_CURRENCIES: CurrencyMint[] = [
  { mint: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL', symbol: 'SOL' },
  { mint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', name: 'Wrapped Bitcoin (Portal)', symbol: 'WBTC' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin', symbol: 'USDC' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', name: 'Tether USD', symbol: 'USDT' },
]

const DEFAULT_WHITELIST: WhitelistSettings = {
  programId: 'whi5uDPWK4rAE9Sus6hdxdHwsG1hjDBn6kXM6pyqwTn',
  account: '',
}

interface MarketplaceForm {
  collectionMints: CollectionMint[]
  splAssetMints: SplAssetMint[]
  currencyMints: CurrencyMint[]
  shopFee: ShopFee
  whitelist: WhitelistSettings
}

const props = defineProps<{
  slug: string
  settings: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  saved: [settings: Record<string, unknown>]
}>()

const apiBase = useApiBase()

const form = reactive<MarketplaceForm>({
  collectionMints: [],
  splAssetMints: [],
  currencyMints: [],
  shopFee: {
    wallet: '',
    makerFlatFee: 0,
    takerFlatFee: 0,
    makerPercentFee: 0,
    takerPercentFee: 0,
  },
  whitelist: { ...DEFAULT_WHITELIST },
})

const customCurrencies = computed(() => {
  const baseMints = new Set(BASE_CURRENCIES.map((b) => b.mint))
  return form.currencyMints.filter((c) => !baseMints.has(c.mint))
})

const anyLoading = computed(() => {
  const colLoading = form.collectionMints.some((m) => m._loading)
  const splLoading = form.splAssetMints.some((m) => m._loading)
  const currLoading = customCurrencies.value.some((c) => c._loading)
  return colLoading || splLoading || currLoading
})

const anyError = computed(() => {
  const colErr = form.collectionMints.some((m) => m._error)
  const splErr = form.splAssetMints.some((m) => m._error)
  const currErr = customCurrencies.value.some((c) => c._error)
  return colErr || splErr || currErr
})

const canSave = computed(() => !anyLoading.value && !anyError.value)

const newCollectionMint = ref('')
const addCollectionError = ref('')
const newSplMint = ref('')
const addSplError = ref('')
const newCurrencyMint = ref('')
const addCurrencyError = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref(false)
const selectedCollection = ref<CollectionMint | null>(null)
const showCollectionModal = ref(false)

function openCollectionDetail(collection: CollectionMint) {
  if (collection._loading || collection._error) return
  selectedCollection.value = collection
  showCollectionModal.value = true
}

watch(
  () => props.settings,
  (s) => {
    if (!s) return
    const cm = (s.collectionMints as Array<{ mint: string; name?: string; image?: string; sellerFeeBasisPoints?: number; groupPath?: string[]; collectionSize?: number; uniqueTraitCount?: number; traitTypes?: string[] }>) ?? []
    form.collectionMints = cm.map((m) => ({
      mint: m.mint ?? '',
      name: m.name,
      image: m.image,
      sellerFeeBasisPoints: m.sellerFeeBasisPoints,
      groupPath: m.groupPath,
      collectionSize: m.collectionSize,
      uniqueTraitCount: m.uniqueTraitCount,
      traitTypes: m.traitTypes,
    }))
    const spl = (s.splAssetMints as Array<{ mint: string; name?: string; symbol?: string; image?: string; decimals?: number | null; sellerFeeBasisPoints?: number | null }>) ?? []
    form.splAssetMints = spl.map((m) => ({
      mint: m.mint ?? '',
      name: m.name,
      symbol: m.symbol,
      image: m.image,
      decimals: m.decimals,
      sellerFeeBasisPoints: m.sellerFeeBasisPoints,
    }))
    const cmu = (s.currencyMints as CurrencyMint[]) ?? []
    form.currencyMints = cmu.length > 0 ? cmu.map((c) => ({ ...c, _loading: false, _error: undefined })) : [...BASE_CURRENCIES]
    const sf = s.shopFee as Partial<ShopFee> | undefined
    if (sf) {
      form.shopFee.wallet = sf.wallet ?? ''
      form.shopFee.makerFlatFee = Number(sf.makerFlatFee) || 0
      form.shopFee.takerFlatFee = Number(sf.takerFlatFee) || 0
      form.shopFee.makerPercentFee = Number(sf.makerPercentFee) || 0
      form.shopFee.takerPercentFee = Number(sf.takerPercentFee) || 0
    }
    const wl = (s.whitelist ?? {}) as Partial<WhitelistSettings>
    form.whitelist.programId = (wl.programId as string) || DEFAULT_WHITELIST.programId
    form.whitelist.account = (wl.account as string) ?? ''
    nextTick(() => fillMissingCollectionCounts())
  },
  { immediate: true }
)

async function fillMissingCollectionCounts() {
  for (let i = 0; i < form.collectionMints.length; i++) {
    const m = form.collectionMints[i]
    if (m._loading || m._error || (m.collectionSize != null && m.collectionSize > 0)) continue
    try {
      const res = await fetch(`${apiBase.value}/api/v1/marketplace/asset-preview/collection/${encodeURIComponent(m.mint)}`)
      if (!res.ok) continue
      const data = (await res.json()) as { collectionSize?: number; uniqueTraitCount?: number; traitTypes?: string[] }
      const existing = form.collectionMints[i]
      if (existing && existing.mint === m.mint) {
        existing.collectionSize = data.collectionSize ?? 0
        existing.uniqueTraitCount = data.uniqueTraitCount ?? 0
        existing.traitTypes = data.traitTypes ?? []
      }
    } catch {
      // ignore per-mint errors
    }
  }
}

function onBaseToggle(symbol: string, checked: boolean) {
  const base = BASE_CURRENCIES.find((b) => b.symbol === symbol)
  if (!base) return
  if (checked) {
    if (!form.currencyMints.some((c) => c.mint === base.mint)) {
      form.currencyMints = [...form.currencyMints, base]
    }
  } else {
    form.currencyMints = form.currencyMints.filter((c) => c.mint !== base.mint)
  }
}

async function addCollection() {
  const mint = newCollectionMint.value.trim()
  if (!mint || mint.length < 32) {
    addCollectionError.value = 'Invalid mint address'
    return
  }
  if (form.collectionMints.some((m) => m.mint === mint)) {
    addCollectionError.value = 'Collection already added'
    return
  }
  if (form.collectionMints.length >= 250) {
    addCollectionError.value = 'Maximum 250 collections'
    return
  }
  addCollectionError.value = ''
  const item: CollectionMint = { mint, _loading: true }
  form.collectionMints.push(item)
  newCollectionMint.value = ''
  const idx = form.collectionMints.length - 1
  try {
    const res = await fetch(`${apiBase.value}/api/v1/marketplace/asset-preview/collection/${encodeURIComponent(mint)}`)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(data.message ?? `HTTP ${res.status}`)
    }
    const data = (await res.json()) as { name?: string; image?: string; collectionSize?: number; uniqueTraitCount?: number; traitTypes?: string[] }
    form.collectionMints[idx] = {
      mint,
      name: data.name ?? undefined,
      image: data.image ?? undefined,
      collectionSize: data.collectionSize ?? 0,
      uniqueTraitCount: data.uniqueTraitCount ?? 0,
      traitTypes: data.traitTypes ?? [],
    }
  } catch (e) {
    form.collectionMints[idx] = { ...item, _loading: false, _error: e instanceof Error ? e.message : 'Failed to load' }
  }
}

function removeCollection(idx: number) {
  form.collectionMints.splice(idx, 1)
}

async function addSpl() {
  const mint = newSplMint.value.trim()
  if (!mint || mint.length < 32) {
    addSplError.value = 'Invalid mint address'
    return
  }
  if (form.splAssetMints.some((m) => m.mint === mint)) {
    addSplError.value = 'Mint already added'
    return
  }
  if (form.splAssetMints.length >= 250) {
    addSplError.value = 'Maximum 250 SPL assets'
    return
  }
  addSplError.value = ''
  const item: SplAssetMint = { mint, _loading: true }
  form.splAssetMints.push(item)
  newSplMint.value = ''
  const idx = form.splAssetMints.length - 1
  try {
    const res = await fetch(`${apiBase.value}/api/v1/marketplace/asset-preview/spl/${encodeURIComponent(mint)}`)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(data.message ?? `HTTP ${res.status}`)
    }
    const data = (await res.json()) as { name?: string; symbol?: string; image?: string; decimals?: number; sellerFeeBasisPoints?: number }
    form.splAssetMints[idx] = {
      mint,
      name: data.name ?? undefined,
      symbol: data.symbol ?? undefined,
      image: data.image ?? undefined,
      decimals: data.decimals ?? undefined,
      sellerFeeBasisPoints: data.sellerFeeBasisPoints ?? undefined,
    }
  } catch (e) {
    form.splAssetMints[idx] = { ...item, _loading: false, _error: e instanceof Error ? e.message : 'Failed to load' }
  }
}

function removeSpl(idx: number) {
  form.splAssetMints.splice(idx, 1)
}

async function lookupAndAddCurrency() {
  const mint = newCurrencyMint.value.trim()
  if (!mint || mint.length < 32) {
    addCurrencyError.value = 'Invalid mint address'
    return
  }
  const baseMints = new Set(BASE_CURRENCIES.map((b) => b.mint))
  if (baseMints.has(mint)) {
    addCurrencyError.value = 'Already in base currencies'
    return
  }
  if (form.currencyMints.some((c) => c.mint === mint)) {
    addCurrencyError.value = 'Currency already added'
    return
  }
  addCurrencyError.value = ''
  const item: CurrencyMint = {
    mint,
    name: '',
    symbol: '',
    _loading: true,
  }
  form.currencyMints.push(item)
  newCurrencyMint.value = ''
  const idx = form.currencyMints.length - 1
  try {
    const res = await fetch(`${apiBase.value}/api/v1/marketplace/asset-preview/spl/${encodeURIComponent(mint)}`)
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`)
    }
    const data = (await res.json()) as { name?: string; symbol?: string; image?: string; decimals?: number; sellerFeeBasisPoints?: number }
    form.currencyMints[idx] = {
      mint,
      name: data.name ?? '',
      symbol: data.symbol ?? '',
      image: data.image ?? undefined,
      decimals: data.decimals ?? undefined,
      sellerFeeBasisPoints: data.sellerFeeBasisPoints ?? undefined,
    }
  } catch (e) {
    form.currencyMints[idx] = { ...item, _loading: false, _error: e instanceof Error ? e.message : 'Failed to load' }
  }
}

function removeCustomCurrency(idx: number) {
  const baseMints = new Set(BASE_CURRENCIES.map((b) => b.mint))
  const custom = form.currencyMints.filter((c) => !baseMints.has(c.mint))
  const removed = custom[idx]
  if (removed) {
    const i = form.currencyMints.indexOf(removed)
    if (i >= 0) form.currencyMints.splice(i, 1)
  }
}

function buildPayload(): Record<string, unknown> {
  return {
    collectionMints: form.collectionMints
      .filter((m) => !m._error)
      .map((m) => ({
        mint: m.mint,
        name: m.name,
        image: m.image,
        sellerFeeBasisPoints: m.sellerFeeBasisPoints,
        groupPath: m.groupPath,
        collectionSize: m.collectionSize,
        uniqueTraitCount: m.uniqueTraitCount,
        traitTypes: m.traitTypes,
      })),
    splAssetMints: form.splAssetMints
      .filter((m) => !m._error)
      .map((m) => ({ mint: m.mint, name: m.name, symbol: m.symbol, decimals: m.decimals, image: m.image, sellerFeeBasisPoints: m.sellerFeeBasisPoints })),
    currencyMints: form.currencyMints
      .filter((c) => !('_error' in c && c._error))
      .map((c) => ({ mint: c.mint, name: c.name ?? '', symbol: c.symbol ?? '', decimals: c.decimals, image: c.image, sellerFeeBasisPoints: c.sellerFeeBasisPoints })),
    shopFee: form.shopFee,
    whitelist: form.whitelist,
  }
}

async function save() {
  if (!props.slug || !canSave.value) return
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    const res = await fetch(`${apiBase.value}/api/v1/tenant/${props.slug}/marketplace-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(buildPayload()),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      let msg = data.error ?? 'Failed to save'
      if (res.status === 401) msg = 'Sign in with your wallet to save. Session may have expired.'
      if (res.status === 403) msg = 'Admin access required.'
      throw new Error(msg)
    }
    const data = (await res.json()) as { settings?: Record<string, unknown> }
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
    emit('saved', data.settings ?? {})
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.marketplace-settings {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-lg);
}

.marketplace-settings__hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin-bottom: var(--theme-space-md);
}

.marketplace-settings__add-mint {
  display: flex;
  gap: var(--theme-space-sm);
  align-items: flex-start;
  margin-bottom: var(--theme-space-md);
}

.marketplace-settings__add-mint .text-input {
  flex: 1;
}

.marketplace-settings__base-toggles {
  display: flex;
  gap: var(--theme-space-lg);
  flex-wrap: wrap;
  margin-bottom: var(--theme-space-md);
}

.marketplace-settings__checkbox {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  cursor: pointer;
  font-size: var(--theme-font-sm);
}

.marketplace-settings__custom {
  margin-top: var(--theme-space-md);
}

.marketplace-settings__mint-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.marketplace-settings__mint-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--theme-space-sm);
  padding: var(--theme-space-sm) 0;
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.marketplace-settings__mint-item--clickable .marketplace-settings__mint-row {
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.marketplace-settings__mint-item--clickable .marketplace-settings__mint-row:hover:not(:disabled) {
  opacity: 0.9;
}

.marketplace-settings__mint-row {
  display: flex;
  align-items: center;
  gap: var(--theme-space-md);
  flex: 1;
  min-width: 0;
}

.marketplace-settings__mint-row--plain {
  cursor: default;
}

button.marketplace-settings__mint-row {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
}

.marketplace-settings__mint-thumb {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--theme-radius-sm, 4px);
  overflow: hidden;
  background: var(--theme-bg-muted, #eee);
}

.marketplace-settings__mint-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.marketplace-settings__mint-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--theme-text-muted);
  font-size: 1.25rem;
}

.marketplace-settings__mint-address {
  display: block;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  font-family: var(--theme-font-mono, monospace);
  word-break: break-all;
}

.marketplace-settings__mint-item:last-child {
  border-bottom: none;
}

.marketplace-settings__mint-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.marketplace-settings__mint-name {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  font-family: var(--theme-font-mono, monospace);
}

.marketplace-settings__mint-meta {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.marketplace-settings__traits-hint {
  opacity: 0.9;
}

.marketplace-settings__mint-status {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.marketplace-settings__mint-error {
  font-size: var(--theme-font-xs);
  color: var(--theme-error);
}

.marketplace-settings__spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.marketplace-settings__empty {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.marketplace-settings__fee-row {
  display: flex;
  gap: var(--theme-space-md);
  margin-top: var(--theme-space-md);
}

.marketplace-settings__fee-row .text-input {
  flex: 1;
}

.marketplace-settings__actions {
  margin-top: var(--theme-space-md);
}

.marketplace-settings__error {
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
  margin-top: var(--theme-space-sm);
}

.marketplace-settings__success {
  font-size: var(--theme-font-sm);
  color: var(--theme-success, #22c55e);
  margin-top: var(--theme-space-sm);
}
</style>
