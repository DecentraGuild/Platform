<template>
  <div class="market-open-trades">
    <StatusBanner
      v-if="!apiBase"
      variant="error"
      message="API is not configured. Set NUXT_PUBLIC_API_URL."
    />
    <StatusBanner
      v-else-if="!connected"
      variant="info"
      message="Connect your wallet to manage your escrows."
    />
    <div v-else>
      <div class="market-open-trades__toolbar">
        <button
          type="button"
          class="market-open-trades__create-btn"
          :class="{ 'market-open-trades__create-btn--disabled': props.createDisabled }"
          :disabled="props.createDisabled"
          @click="!props.createDisabled && emit('open-create-trade')"
        >
          <Icon icon="mdi:plus" class="market-open-trades__create-btn-icon" />
          <span>New trade</span>
        </button>
      </div>
      <StatusBanner
        v-if="loading"
        variant="loading"
        message="Loading your escrows..."
      />
      <StatusBanner
        v-else-if="error"
        variant="error"
        :message="error"
      />
      <StatusBanner
        v-else-if="!escrows.length"
        variant="empty"
        message="You have no open escrows in this dGuild."
      />
      <div v-else class="market-open-trades__list">
        <section
          v-for="group in groupedByDeposit"
          :key="group.depositMint"
          class="market-open-trades__group"
        >
          <h3 class="market-open-trades__group-heading">
            <MintLabel :mint="group.depositMint" />
          </h3>
          <div class="market-open-trades__group-items">
            <NuxtLink
              v-for="item in group.escrows"
              :key="item.publicKey.toBase58()"
              :to="myTradesEscrowLink(item.publicKey.toBase58())"
              class="market-open-trades__row-link"
            >
              <ManageEscrowCard
                :escrow="item"
                :escrow-link="myTradesEscrowLink(item.publicKey.toBase58())"
                :show-quick-cancel="true"
                :cancelling="cancellingId === item.publicKey.toBase58()"
                @cancel="handleQuickCancel(item)"
              />
            </NuxtLink>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { Connection } from '@solana/web3.js'
import {
  buildCancelTransaction,
  sendAndConfirmTransaction,
  getEscrowWalletFromConnector,
} from '@decentraguild/web3'
import { Icon } from '@iconify/vue'
import { StatusBanner } from '@decentraguild/ui/components'
import ManageEscrowCard from './ManageEscrowCard.vue'
import MintLabel from './MintLabel.vue'
import { useTenantStore } from '~/stores/tenant'
import { useMarketplaceEscrowLinks } from '~/composables/useMarketplaceEscrowLinks'
import { API_V1 } from '~/utils/apiBase'
import { useApiBase } from '~/composables/useApiBase'
import { useAuth } from '@decentraguild/auth'
import { useRpc } from '~/composables/useRpc'
import { useTransactionNotificationsStore } from '~/stores/transactionNotifications'
import type { EscrowWithAddress } from '@decentraguild/web3'
import type { EscrowApiShape } from '~/composables/useEscrowsForMints'


const props = withDefaults(
  defineProps<{ tabActive?: boolean; createDisabled?: boolean }>(),
  { tabActive: false, createDisabled: false }
)
const emit = defineEmits<{ 'open-create-trade': [] }>()

function myTradesEscrowLink(id: string) {
  return escrowLink(id, { tab: 'open-trades' })
}

const tenantStore = useTenantStore()
const auth = useAuth()
const { rpcUrl } = useRpc()
const txNotifications = useTransactionNotificationsStore()

const apiBase = useApiBase()
const { escrowLink } = useMarketplaceEscrowLinks(
  computed(() => tenantStore.slug)
)

const connected = computed(() => auth.connectorState.value?.connected ?? false)
const walletAddress = computed(() => auth.connectorState.value?.account ?? null)

const escrows = ref<EscrowWithAddress[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const cancellingId = ref<string | null>(null)

const groupedByDeposit = computed(() => {
  const list = escrows.value
  if (!list.length) return []
  const byDeposit = new Map<string, EscrowWithAddress[]>()
  for (const e of list) {
    const mint = e.account.depositToken.toBase58()
    const arr = byDeposit.get(mint) ?? []
    arr.push(e)
    byDeposit.set(mint, arr)
  }
  for (const arr of byDeposit.values()) {
    arr.sort((a, b) => (a.account.price ?? 0) - (b.account.price ?? 0))
  }
  const groups = [...byDeposit.entries()].map(([depositMint, escrows]) => ({
    depositMint,
    escrows,
    minPrice: Math.min(...escrows.map((e) => e.account.price ?? 0)),
  }))
  groups.sort((a, b) => a.minPrice - b.minPrice)
  return groups.map(({ depositMint, escrows: es }) => ({ depositMint, escrows: es }))
})

function apiToFull(e: EscrowApiShape): EscrowWithAddress {
  const acc = e.account
  return {
    publicKey: new PublicKey(e.publicKey),
    account: {
      maker: new PublicKey(acc.maker),
      depositToken: new PublicKey(acc.depositToken),
      requestToken: new PublicKey(acc.requestToken),
      tokensDepositInit: new BN(acc.tokensDepositInit),
      tokensDepositRemaining: new BN(acc.tokensDepositRemaining),
      price: acc.price,
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

async function load() {
  const addr = walletAddress.value
  const slug = tenantStore.slug
  if (!apiBase.value || !slug || !addr) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    const url = `${apiBase.value}${API_V1}/tenant/${encodeURIComponent(slug)}/marketplace/escrows?maker=${encodeURIComponent(addr)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { escrows?: EscrowApiShape[] }
    const raw = Array.isArray(data.escrows) ? data.escrows : []
    escrows.value = raw.map(apiToFull)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load escrows'
    escrows.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [walletAddress.value, tenantStore.slug, apiBase.value],
  () => { void load() },
  { immediate: false }
)
watch(
  () => props.tabActive,
  (active) => { if (active) void load() }
)
onMounted(() => { void load() })

async function handleQuickCancel(escrow: EscrowWithAddress) {
  const wallet = getEscrowWalletFromConnector()
  if (!wallet || !escrow) return
  const id = escrow.publicKey.toBase58()
  cancellingId.value = id
  const txId = `cancel-${id}-${Date.now()}`
  txNotifications.add(txId, { status: 'pending', message: 'Cancelling escrow...' })
  try {
    const connection = new Connection(rpcUrl.value)
    const tx = await buildCancelTransaction({
      maker: escrow.account.maker,
      depositTokenMint: escrow.account.depositToken,
      requestTokenMint: escrow.account.requestToken,
      seed: escrow.account.seed,
      connection,
      wallet,
    })
    const sig = await sendAndConfirmTransaction(connection, tx, wallet, escrow.account.maker)
    txNotifications.update(txId, { status: 'success', message: 'Escrow cancelled', signature: sig })
    escrows.value = escrows.value.filter((e) => e.publicKey.toBase58() !== id)
  } catch (e) {
    txNotifications.update(txId, {
      status: 'error',
      message: e instanceof Error ? e.message : 'Cancel failed',
    })
  } finally {
    cancellingId.value = null
  }
}
</script>

<style scoped>
.market-open-trades__toolbar {
  margin-bottom: var(--theme-space-md);
}

.market-open-trades__create-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-xs) var(--theme-space-md);
  background: var(--theme-primary);
  color: var(--theme-primary-inverse);
  border: none;
  border-radius: var(--theme-radius-md);
  font-size: var(--theme-font-sm);
  font-weight: 500;
  cursor: pointer;
}

.market-open-trades__create-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.market-open-trades__create-btn--disabled,
.market-open-trades__create-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-muted);
}

.market-open-trades__create-btn-icon {
  font-size: 1.125rem;
}

.market-open-trades__list {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  padding: 0;
}

.market-open-trades__group {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.market-open-trades__group:not(:last-child) {
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.market-open-trades__group-heading {
  font-size: var(--theme-font-xs);
  font-weight: 600;
  color: var(--theme-text-secondary);
  margin: 0;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.market-open-trades__group-items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.market-open-trades__row-link {
  text-decoration: none;
  color: inherit;
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.market-open-trades__row-link:last-child {
  border-bottom: none;
}
</style>
