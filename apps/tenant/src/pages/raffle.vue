<template>
  <PageSection title="Raffle">
    <div
      class="raffle-page"
      :class="{ 'raffle-page--selected': !!selectedRaffle }"
      :style="selectedRaffle?.chainData?.url ? { '--raffle-bg-image': `url(${selectedRaffle.chainData.url})` } : {}"
    >
      <p v-if="!tenantStore.tenant?.modules?.raffles" class="raffle-page__empty">
        Raffle module is not enabled for this community.
      </p>
      <template v-else>
        <div v-if="loading" class="raffle-page__loading">
          <Icon icon="mdi:loading" class="raffle-page__spinner" />
          <span>Loading raffles...</span>
        </div>
        <div v-else-if="visibleRaffles.length === 0" class="raffle-page__empty">
          <p>No active raffles yet.</p>
        </div>
        <div v-else class="raffle-page__layout">
          <div class="raffle-page__grid">
            <button
              v-for="r in visibleRaffles"
              :key="r.rafflePubkey"
              type="button"
              class="raffle-card"
              :class="{ 'raffle-card--selected': selectedRaffle?.rafflePubkey === r.rafflePubkey }"
              :style="r.chainData?.url ? { backgroundImage: `url(${r.chainData.url})` } : {}"
              @click="selectRaffle(r)"
            >
              <div class="raffle-card__overlay" />
              <div class="raffle-card__content">
                <h3 class="raffle-card__name">{{ r.chainData?.name ?? 'Raffle' }}</h3>
                <p v-if="r.chainData?.description" class="raffle-card__desc">{{ r.chainData.description }}</p>
                <p v-if="r.chainData" class="raffle-card__price">
                  {{ formatTicketPrice(r.chainData) }} per ticket
                </p>
                <p v-if="r.chainData" class="raffle-card__tickets">
                  {{ r.chainData.ticketsSold }} / {{ r.chainData.ticketsTotal }} tickets
                </p>
                <span
                  v-if="r.chainData"
                  class="raffle-card__state"
                  :class="`raffle-card__state--${r.chainData.state}`"
                >
                  {{ r.chainData.stateDisplay }}
                </span>
                <div class="raffle-card__footer">
                  <code class="raffle-card__pubkey">{{ truncateMint(r.chainData?.ticketMint ?? '') }}</code>
                  <a
                    :href="solscanUrl(r.rafflePubkey)"
                    target="_blank"
                    rel="noopener"
                    class="raffle-card__link"
                    @click.stop
                  >
                    <Icon icon="mdi:open-in-new" />
                  </a>
                </div>
              </div>
            </button>
          </div>
          <aside v-if="selectedRaffle" class="raffle-page__panel">
            <div class="raffle-panel">
              <h3 class="raffle-panel__title">{{ selectedRaffle.chainData?.name ?? 'Raffle' }}</h3>
              <p v-if="selectedRaffle.chainData?.description" class="raffle-panel__desc">
                {{ selectedRaffle.chainData.description }}
              </p>
              <p v-if="selectedRaffle.chainData" class="raffle-panel__meta">
                {{ selectedRaffle.chainData.ticketsSold }} / {{ selectedRaffle.chainData.ticketsTotal }} tickets sold
              </p>
              <p v-if="selectedRaffle.chainData" class="raffle-panel__price">
                {{ formatTicketPrice(selectedRaffle.chainData) }} per ticket
              </p>
              <template v-if="canBuyTickets">
                <div class="raffle-panel__field">
                  <label class="raffle-panel__label">Number of tickets</label>
                  <input
                    v-model.number="buyAmount"
                    type="number"
                    min="1"
                    :max="availableTickets"
                    class="raffle-panel__input"
                    placeholder="1"
                  />
                </div>
                <p class="raffle-panel__total">
                  Total: {{ formatTotalCost }}
                </p>
                <Button
                  :disabled="!canSubmitBuy || buySubmitting"
                  @click="onBuyTickets"
                >
                  <Icon v-if="buySubmitting" icon="mdi:loading" class="raffle-panel__btn-spinner" />
                  <span v-else>Buy tickets</span>
                </Button>
                <p v-if="buyTxStatus" class="raffle-panel__status">{{ buyTxStatus }}</p>
                <p v-if="buyError" class="raffle-panel__error">{{ buyError }}</p>
              </template>
              <p v-else class="raffle-panel__hint">
                {{ selectedRaffle.chainData?.state !== 'running' ? 'This raffle is not currently accepting ticket purchases.' : 'Connect your wallet to buy tickets.' }}
              </p>
              <button type="button" class="raffle-panel__close" @click="selectedRaffle = null">
                <Icon icon="mdi:close" />
              </button>
            </div>
          </aside>
        </div>
      </template>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
import type { RaffleChainData } from '@decentraguild/web3'
import {
  fetchRaffleChainData,
  isRaffleVisibleToUsers,
  buildBuyTicketsTransaction,
  sendAndConfirmTransaction,
  getEscrowWalletFromConnector,
} from '@decentraguild/web3'
import { PageSection } from '@decentraguild/ui/components'
import { Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import { useTenantStore } from '~/stores/tenant'
import { useSolanaConnection } from '~/composables/useSolanaConnection'
import { useMintMetadata } from '~/composables/useMintMetadata'
import { API_V1 } from '~/utils/apiBase'

const tenantStore = useTenantStore()
const apiBase = useApiBase()
const { connection } = useSolanaConnection()
const { fetchMetadata } = useMintMetadata()
const slug = computed(() => tenantStore.slug ?? '')

interface RaffleItem {
  id: string
  rafflePubkey: string
  createdAt: string
  closedAt: string | null
}

interface RaffleWithChainData extends RaffleItem {
  chainData: RaffleChainData | null
}

const raffles = ref<RaffleItem[]>([])
const chainDataByRaffle = ref<Record<string, RaffleChainData | null>>({})
const loading = ref(true)
const selectedRaffle = ref<RaffleWithChainData | null>(null)
const buyAmount = ref(1)
const buySubmitting = ref(false)
const buyTxStatus = ref<string | null>(null)
const buyError = ref<string | null>(null)
const ticketSymbolByMint = ref<Record<string, string>>({})

const visibleRaffles = computed((): RaffleWithChainData[] => {
  const active = raffles.value.filter((r) => !r.closedAt)
  const chain = chainDataByRaffle.value
  return active
    .map((r) => ({
      ...r,
      chainData: chain[r.rafflePubkey] ?? null,
    }))
    .filter((r) => {
      if (!r.chainData) return false
      return isRaffleVisibleToUsers(r.chainData.state)
    })
})

const canBuyTickets = computed(() => {
  const r = selectedRaffle.value
  if (!r?.chainData || r.chainData.state !== 'running') return false
  const wallet = getEscrowWalletFromConnector()
  return !!wallet?.publicKey
})

const availableTickets = computed(() => {
  const r = selectedRaffle.value?.chainData
  if (!r) return 0
  return Math.max(0, r.ticketsTotal - r.ticketsSold)
})

const canSubmitBuy = computed(() => {
  const n = buyAmount.value
  return Number.isInteger(n) && n >= 1 && n <= availableTickets.value
})

const formatTotalCost = computed(() => {
  const r = selectedRaffle.value?.chainData
  if (!r) return '0'
  const total = r.ticketPrice * BigInt(Math.max(0, buyAmount.value))
  const dec = r.ticketDecimals
  const divisor = 10 ** dec
  const whole = Number(total / BigInt(divisor))
  const frac = Number(total % BigInt(divisor))
  const fracStr = frac === 0 ? '' : `.${String(frac).padStart(dec, '0').replace(/0+$/, '')}`
  const symbol = ticketSymbolByMint.value[r.ticketMint] ?? 'tokens'
  return `${whole}${fracStr} ${symbol}`
})

function formatTicketPrice(data: RaffleChainData): string {
  const dec = data.ticketDecimals
  const divisor = 10 ** dec
  const whole = Number(data.ticketPrice / BigInt(divisor))
  const frac = Number(data.ticketPrice % BigInt(divisor))
  const fracStr = frac === 0 ? '' : `.${String(frac).padStart(dec, '0').replace(/0+$/, '')}`
  const symbol = ticketSymbolByMint.value[data.ticketMint] ?? 'tokens'
  return `${whole}${fracStr} ${symbol}`
}

function truncateMint(mint: string): string {
  if (!mint || mint.length < 12) return mint
  return `${mint.slice(0, 6)}...${mint.slice(-4)}`
}

function solscanUrl(pubkey: string): string {
  const cluster = process.env.NODE_ENV === 'production' ? '' : '?cluster=devnet'
  return `https://solscan.io/account/${pubkey}${cluster}`
}

function selectRaffle(r: RaffleWithChainData) {
  selectedRaffle.value = selectedRaffle.value?.rafflePubkey === r.rafflePubkey ? null : r
  buyAmount.value = 1
  buyError.value = null
  buyTxStatus.value = null
}

async function loadTicketSymbol(mint: string) {
  if (ticketSymbolByMint.value[mint]) return
  const meta = await fetchMetadata(mint)
  if (meta?.symbol) ticketSymbolByMint.value[mint] = meta.symbol
}

async function fetchChainData() {
  if (!connection.value) return
  const active = raffles.value.filter((r) => !r.closedAt)
  const next: Record<string, RaffleChainData | null> = {}
  for (const r of active) {
    try {
      const data = await fetchRaffleChainData(connection.value!, r.rafflePubkey)
      next[r.rafflePubkey] = data ?? null
      if (data?.ticketMint) void loadTicketSymbol(data.ticketMint)
    } catch {
      next[r.rafflePubkey] = null
    }
  }
  chainDataByRaffle.value = next
}

async function onBuyTickets() {
  const r = selectedRaffle.value
  const conn = connection.value
  const wallet = getEscrowWalletFromConnector()
  if (!r?.chainData || !conn || !wallet?.publicKey || r.chainData.state !== 'running') return
  if (!canSubmitBuy.value) return

  buySubmitting.value = true
  buyError.value = null
  buyTxStatus.value = null

  try {
    const amount = Math.floor(buyAmount.value)
    const fresh = await fetchRaffleChainData(conn, r.rafflePubkey)
    if (!fresh || fresh.state !== 'running') {
      buyError.value = 'Raffle is no longer available'
      return
    }
    const available = fresh.ticketsTotal - fresh.ticketsSold
    if (amount > available) {
      buyError.value = `Only ${available} ticket(s) left. Please reduce your amount.`
      return
    }

    const tx = await buildBuyTicketsTransaction({
      rafflePubkey: r.rafflePubkey,
      ticketAmount: amount,
      chainData: {
        ticketMint: fresh.ticketMint,
        useWhitelist: fresh.useWhitelist,
        whitelist: fresh.whitelist,
      },
      connection: conn,
      wallet,
    })

    const TX_LABELS: Record<string, string> = {
      signing: 'Signing...',
      sending: 'Sending...',
      confirming: 'Confirming...',
    }
    const sig = await sendAndConfirmTransaction(conn, tx, wallet, wallet.publicKey, {
      onStatus: (s) => {
        buyTxStatus.value = TX_LABELS[s] ?? s
      },
    })

    buyTxStatus.value = 'Success'
    buyError.value = null
    await fetchChainData()
    selectedRaffle.value = visibleRaffles.value.find((x) => x.rafflePubkey === r.rafflePubkey) ?? null
  } catch (e) {
    buyError.value = e instanceof Error ? e.message : 'Transaction failed'
  } finally {
    buySubmitting.value = false
    buyTxStatus.value = null
  }
}

watch(
  () => visibleRaffles.value.map((x) => x.chainData?.ticketMint).filter(Boolean) as string[],
  (mints) => {
    for (const m of mints) void loadTicketSymbol(m)
  },
  { immediate: true }
)

onMounted(async () => {
  if (!slug.value) return
  loading.value = true
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${slug.value}/raffles`, { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as { raffles: RaffleItem[] }
      raffles.value = data.raffles ?? []
      await fetchChainData()
    } else {
      raffles.value = []
    }
  } catch {
    raffles.value = []
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.raffle-page {
  padding: var(--theme-space-md) 0;
  position: relative;
  min-height: 200px;
}

.raffle-page--selected::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: var(--raffle-bg-image);
  background-size: cover;
  background-position: center;
  opacity: 0.12;
  pointer-events: none;
  z-index: 0;
}

.raffle-page__loading,
.raffle-page__empty {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  color: var(--theme-text-secondary);
  font-size: var(--theme-font-md);
}

.raffle-page__spinner {
  animation: raffle-spin 1s linear infinite;
}

@keyframes raffle-spin {
  to { transform: rotate(360deg); }
}

.raffle-page__layout {
  display: flex;
  gap: var(--theme-space-xl);
  align-items: stretch;
  position: relative;
  z-index: 1;
}

.raffle-page__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--theme-space-lg);
  min-width: 0;
}

.raffle-card {
  position: relative;
  padding: 0;
  min-height: 200px;
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: var(--theme-bg-card);
  background-size: cover;
  background-position: center;
}

.raffle-card--selected {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 2px var(--theme-primary);
}

.raffle-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 70%);
  pointer-events: none;
}

.raffle-card__content {
  position: relative;
  padding: var(--theme-space-lg);
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

.raffle-card__name {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  margin: 0 0 var(--theme-space-xs);
  line-height: 1.2;
}

.raffle-card__desc {
  font-size: var(--theme-font-sm);
  margin: 0 0 var(--theme-space-sm);
  opacity: 0.9;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.raffle-card__price {
  font-size: var(--theme-font-sm);
  margin: 0 0 var(--theme-space-xs);
  font-weight: 500;
}

.raffle-card__tickets {
  font-size: var(--theme-font-xs);
  margin: 0 0 var(--theme-space-sm);
  opacity: 0.9;
}

.raffle-card__state {
  display: inline-block;
  align-self: flex-start;
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  font-weight: 600;
  text-transform: uppercase;
  border-radius: var(--theme-radius-sm);
  background: var(--theme-primary);
  color: white;
  margin-bottom: var(--theme-space-sm);
}

.raffle-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--theme-space-sm);
  margin-top: auto;
}

.raffle-card__pubkey {
  font-size: var(--theme-font-xs);
  font-family: var(--theme-font-mono, monospace);
  opacity: 0.8;
}

.raffle-card__link {
  color: rgba(255,255,255,0.8);
  display: inline-flex;
}

.raffle-card__link:hover {
  color: white;
}

.raffle-page__panel {
  flex-shrink: 0;
  width: 320px;
}

@media (max-width: 900px) {
  .raffle-page__layout {
    flex-direction: column;
  }
  .raffle-page__panel {
    width: 100%;
  }
}

.raffle-panel {
  position: sticky;
  top: var(--theme-space-md);
  top: var(--theme-space-md);
  padding: var(--theme-space-lg);
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
}

.raffle-panel__title {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  margin: 0 2rem var(--theme-space-sm) 0;
}

.raffle-panel__desc {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0 0 var(--theme-space-sm);
}

.raffle-panel__meta {
  font-size: var(--theme-font-sm);
  margin: 0 0 var(--theme-space-xs);
}

.raffle-panel__price {
  font-size: var(--theme-font-sm);
  font-weight: 500;
  margin: 0 0 var(--theme-space-md);
}

.raffle-panel__field {
  margin-bottom: var(--theme-space-md);
}

.raffle-panel__label {
  display: block;
  font-size: var(--theme-font-sm);
  font-weight: 500;
  margin-bottom: var(--theme-space-xs);
}

.raffle-panel__input {
  width: 100%;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-md);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg);
}

.raffle-panel__total {
  font-size: var(--theme-font-md);
  font-weight: 600;
  margin: 0 0 var(--theme-space-md);
}

.raffle-panel__status {
  font-size: var(--theme-font-sm);
  color: var(--theme-primary);
  margin: var(--theme-space-sm) 0 0;
}

.raffle-panel__error {
  font-size: var(--theme-font-sm);
  color: var(--theme-error, #dc3545);
  margin: var(--theme-space-sm) 0 0;
}

.raffle-panel__hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.raffle-panel__close {
  position: absolute;
  top: var(--theme-space-sm);
  right: var(--theme-space-sm);
  padding: var(--theme-space-xs);
  color: var(--theme-text-muted);
  background: none;
  border: none;
  cursor: pointer;
}

.raffle-panel__close:hover {
  color: var(--theme-text-primary);
}

.raffle-panel__btn-spinner {
  animation: raffle-spin 1s linear infinite;
}
</style>
