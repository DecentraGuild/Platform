<template>
  <Teleport to="body">
    <div v-if="modelValue" class="escrow-modal-overlay" @click.self="close">
      <div class="escrow-modal">
        <header class="escrow-modal__header">
          <h2 class="escrow-modal__title">{{ isMaker ? 'Your trade' : 'Trade details' }}</h2>
          <div class="escrow-modal__header-actions">
            <button
              v-if="escrow && !isMaker"
              type="button"
              class="escrow-modal__icon-btn"
              aria-label="Copy link"
              @click="copyShareLinkAndNotify"
            >
              <Icon icon="mdi:share-variant" />
            </button>
            <button
              type="button"
              class="escrow-modal__icon-btn escrow-modal__close"
              aria-label="Close"
              @click="close"
            >
              <Icon icon="mdi:close" />
            </button>
          </div>
        </header>
        <StatusBanner
          v-if="rpcError && !apiAvailable"
          variant="error"
          :message="rpcError"
        >
          <template #hint>
            <p class="escrow-modal__rpc-hint">Set NUXT_PUBLIC_HELIUS_RPC in your environment.</p>
          </template>
        </StatusBanner>
        <StatusBanner
          v-else-if="rpcError && apiAvailable"
          variant="info"
          message="RPC is not configured. You can view this trade, but filling requires NUXT_PUBLIC_HELIUS_RPC."
        />
        <StatusBanner
          v-else-if="loading"
          variant="loading"
          message="Loading escrow..."
        />
        <StatusBanner
          v-else-if="!escrow"
          variant="empty"
          message="Escrow not found."
        />
        <template v-else>
          <div class="escrow-modal__body">
            <!-- Owner block: Fill (folded), Cancel, Details 2-col -->
            <section v-if="isMaker" class="escrow-modal__owner">
              <section class="escrow-modal__details">
                <button
                  type="button"
                  class="escrow-modal__details-toggle"
                  :aria-expanded="ownerFillOpen"
                  @click="ownerFillOpen = !ownerFillOpen"
                >
                  <span>Fill trade</span>
                  <Icon :icon="ownerFillOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
                </button>
                <div v-show="ownerFillOpen" class="escrow-modal__details-content">
                  <div v-if="!display" class="escrow-modal__fill-loading">Loading trade details...</div>
                  <div v-else class="escrow-modal__fill-content">
                    <div class="escrow-modal__rate">
                      <span class="escrow-modal__rate-label">Rate</span>
                      <button
                        type="button"
                        class="escrow-modal__rate-value"
                        :title="ratioFlipped ? 'Show 1 deposit per X request' : 'Show 1 request per X deposit'"
                        @click="ratioFlipped = !ratioFlipped"
                      >
                        <template v-if="!ratioFlipped">
                          1 {{ sanitizedDepositSymbol }}
                          <span class="escrow-modal__rate-approx">≈</span>
                          {{ chainPrice }}
                          {{ sanitizedPriceSymbol }}
                        </template>
                        <template v-else>
                          1 {{ sanitizedPriceSymbol }}
                          <span class="escrow-modal__rate-approx">≈</span>
                          {{ chainPrice ? (1 / chainPrice) : '–' }}
                          {{ sanitizedDepositSymbol }}
                        </template>
                        <Icon icon="mdi:swap-horizontal" class="escrow-modal__rate-icon" />
                      </button>
                    </div>
                    <div class="escrow-modal__pay-receive">
                      <div class="escrow-modal__pay-receive-row">
                        <span class="escrow-modal__pay-receive-label">You pay</span>
                        <span class="escrow-modal__pay-receive-value">
                          {{ fillRequestAmountDisplay }}
                          <span class="escrow-modal__pay-receive-token">({{ sanitizedPriceSymbol }}) {{ sanitizedRequestName }}</span>
                        </span>
                      </div>
                      <div class="escrow-modal__pay-receive-row">
                        <span class="escrow-modal__pay-receive-label">You receive</span>
                        <span class="escrow-modal__pay-receive-value">
                          {{ fillDepositAmountDisplay }}
                          <span class="escrow-modal__pay-receive-token">({{ sanitizedDepositSymbol }}) {{ sanitizedDepositName }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <div class="escrow-modal__owner-actions">
                <Button
                  variant="secondary"
                  :disabled="cancelling"
                  @click="handleCancel"
                >
                  {{ cancelling ? 'Cancelling...' : 'Cancel' }}
                </Button>
              </div>
              <h3 class="escrow-modal__section-title">Details</h3>
              <div class="escrow-modal__details-cols">
                <div class="escrow-modal__details-col-left">
                  <dl class="escrow-modal__details-list">
                    <dt>Escrow</dt>
                    <dd>
                      <code>{{ truncateAddress(props.escrowId ?? '', 8, 8) }}</code>
                      <a
                        v-if="props.escrowId"
                        :href="explorerLinks.accountUrl(props.escrowId)"
                        target="_blank"
                        rel="noopener"
                        class="escrow-modal__link"
                        title="View on Solscan"
                      >
                        <Icon icon="mdi:open-in-new" />
                      </a>
                      <button type="button" class="escrow-modal__copy" aria-label="Copy escrow address" @click="copyToClipboard(props.escrowId ?? '', 'Escrow address')">
                        <Icon icon="mdi:content-copy" />
                      </button>
                    </dd>
                    <dt>Maker</dt>
                    <dd>
                      <code>{{ truncateAddress(escrow.account.maker.toBase58(), 8, 8) }}</code>
                      <a :href="explorerLinks.accountUrl(escrow.account.maker.toBase58())" target="_blank" rel="noopener" class="escrow-modal__link" title="View on Solscan"><Icon icon="mdi:open-in-new" /></a>
                      <button type="button" class="escrow-modal__copy" aria-label="Copy maker address" @click="copyToClipboard(escrow.account.maker.toBase58(), 'Maker address')"><Icon icon="mdi:content-copy" /></button>
                    </dd>
                    <dt>Deposit token</dt>
                    <dd>
                      <code>{{ truncateAddress(escrow.account.depositToken.toBase58(), 8, 8) }}</code>
                      <a :href="explorerLinks.tokenUrl(escrow.account.depositToken.toBase58())" target="_blank" rel="noopener" class="escrow-modal__link" title="View on Solscan"><Icon icon="mdi:open-in-new" /></a>
                      <button type="button" class="escrow-modal__copy" aria-label="Copy mint" @click="copyToClipboard(escrow.account.depositToken.toBase58(), 'Deposit token mint')"><Icon icon="mdi:content-copy" /></button>
                    </dd>
                    <dt>Request token</dt>
                    <dd>
                      <code>{{ truncateAddress(escrow.account.requestToken.toBase58(), 8, 8) }}</code>
                      <a :href="explorerLinks.tokenUrl(escrow.account.requestToken.toBase58())" target="_blank" rel="noopener" class="escrow-modal__link" title="View on Solscan"><Icon icon="mdi:open-in-new" /></a>
                      <button type="button" class="escrow-modal__copy" aria-label="Copy mint" @click="copyToClipboard(escrow.account.requestToken.toBase58(), 'Request token mint')"><Icon icon="mdi:content-copy" /></button>
                    </dd>
                    <dt>Price (chain)</dt>
                    <dd><code>{{ escrow.account.price }}</code></dd>
                    <dt>Remaining (deposit)</dt>
                    <dd>
                      <TokenAmountWithLabel v-if="display" :amount="display.depositAmount" :decimals="display.depositDecimals" :symbol="display.depositSymbol" :name="display.depositName" :mint="escrow.account.depositToken.toBase58()" :show-mint-short="false" />
                    </dd>
                    <dt>Recipient</dt>
                    <dd>{{ isPublicRecipient ? 'Any wallet' : truncateAddress(escrow.account.recipient.toBase58(), 8, 8) }}</dd>
                  </dl>
                </div>
                <div class="escrow-modal__details-col-right">
                  <div v-if="shareUrlValue" class="escrow-modal__owner-qr">
                    <img v-if="shareQrDataUrl" :src="shareQrDataUrl" alt="QR code" class="escrow-modal__owner-qr-img" />
                  </div>
                  <div class="escrow-modal__owner-link-row">
                    <input :value="shareUrlValue" type="text" readonly class="escrow-modal__owner-input" />
                    <button type="button" class="escrow-modal__owner-copy" aria-label="Copy link" @click="copyShareLinkAndNotify">
                      <Icon icon="mdi:content-copy" />
                    </button>
                  </div>
                  <dl class="escrow-modal__details-list escrow-modal__details-list--rest">
                    <dt>Whitelist only</dt>
                    <dd>{{ escrow.account.onlyWhitelist ? 'Yes' : 'No' }}</dd>
                    <dt>Partial fill</dt>
                    <dd>{{ escrow.account.allowPartialFill ? 'Yes' : 'No' }}</dd>
                    <dt>Expires</dt>
                    <dd>{{ expireLabel }}</dd>
                  </dl>
                </div>
              </div>
            </section>

            <!-- Fill section: visible when not maker -->
            <section v-if="!isMaker" class="escrow-modal__fill">
              <h3 class="escrow-modal__section-title">Fill trade</h3>
              <p v-if="props.fillDisabled" class="escrow-modal__fill-winding-down">
                Marketplace is winding down; only cancel is allowed.
              </p>
              <p v-else-if="!display" class="escrow-modal__fill-loading">Loading trade details...</p>
              <div v-else class="escrow-modal__fill-content">
                <!-- Rate: 1 line, label + value + swap -->
                <div class="escrow-modal__rate">
                  <span class="escrow-modal__rate-label">Rate</span>
                  <button
                    type="button"
                    class="escrow-modal__rate-value"
                    :title="ratioFlipped ? 'Show 1 deposit per X request' : 'Show 1 request per X deposit'"
                    @click="ratioFlipped = !ratioFlipped"
                  >
                    <template v-if="!ratioFlipped">
                      1 {{ sanitizedDepositSymbol }}
                      <span class="escrow-modal__rate-approx">≈</span>
                      {{ chainPrice }}
                      {{ sanitizedPriceSymbol }}
                    </template>
                    <template v-else>
                      1 {{ sanitizedPriceSymbol }}
                      <span class="escrow-modal__rate-approx">≈</span>
                      {{ chainPrice ? (1 / chainPrice) : '–' }}
                      {{ sanitizedDepositSymbol }}
                    </template>
                    <Icon icon="mdi:swap-horizontal" class="escrow-modal__rate-icon" />
                  </button>
                </div>
                <!-- Amount to fill: label left, wallet balance top right; then slider -->
                <div class="escrow-modal__fill-amount">
                  <div class="escrow-modal__fill-amount-header">
                    <label class="escrow-modal__label">Amount to fill</label>
                    <div class="escrow-modal__balance-inline">
                      <span class="escrow-modal__balance-label">Balance</span>
                      <template v-if="walletAddress">
                        <TokenAmountWithLabel
                          :amount="requestTokenBalance"
                          :decimals="display.requestDecimals"
                          :symbol="display.priceSymbol"
                          :name="display.requestName"
                          :mint="escrow.account.requestToken.toBase58()"
                          :show-mint-short="false"
                        />
                      </template>
                      <span v-else class="escrow-modal__balance-placeholder">Connect to see</span>
                    </div>
                  </div>
                  <div class="escrow-modal__slider-row">
                    <input
                      v-model.number="fillPercent"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      class="escrow-modal__range"
                      :disabled="!escrow.account.allowPartialFill || !walletAddress"
                    />
                    <span class="escrow-modal__slider-value">{{ fillPercent }}%</span>
                  </div>
                  <div class="escrow-modal__fill-amount-input-row">
                    <input
                      v-model="fillAmountInput"
                      type="text"
                      inputmode="decimal"
                      class="escrow-modal__fill-amount-input"
                      :disabled="!escrow.account.allowPartialFill || !walletAddress"
                      @input="onFillAmountInput"
                      @focus="fillAmountInputFocused = true"
                      @blur="fillAmountInputFocused = false; syncFillAmountInputFromPercent()"
                    />
                    <span class="escrow-modal__fill-amount-token">
                      ({{ sanitizedDepositSymbol }}) {{ sanitizedDepositName }}
                    </span>
                  </div>
                </div>
                <!-- You pay / You receive -->
                <div class="escrow-modal__pay-receive">
                  <div class="escrow-modal__pay-receive-row">
                    <span class="escrow-modal__pay-receive-label">You pay</span>
                    <span class="escrow-modal__pay-receive-value">
                      {{ fillRequestAmountDisplay }}
                      <span class="escrow-modal__pay-receive-token">({{ sanitizedPriceSymbol }}) {{ sanitizedRequestName }}</span>
                    </span>
                  </div>
                  <div class="escrow-modal__pay-receive-row">
                    <span class="escrow-modal__pay-receive-label">You receive</span>
                    <span class="escrow-modal__pay-receive-value">
                      {{ fillDepositAmountDisplay }}
                      <span class="escrow-modal__pay-receive-token">({{ sanitizedDepositSymbol }}) {{ sanitizedDepositName }}</span>
                    </span>
                  </div>
                </div>
                <div v-if="walletAddress && insufficientBalance" class="escrow-modal__insufficient">
                  Insufficient balance to fill this amount.
                </div>
                <div v-if="!props.fillDisabled" class="escrow-modal__fill-actions">
                  <Button
                    v-if="walletAddress && canFill && canSignTransactions"
                    variant="primary"
                    class="escrow-modal__fill-btn"
                    :disabled="filling || insufficientBalance"
                    @click="handleFill"
                  >
                    {{ filling ? 'Processing...' : 'Fill' }}
                  </Button>
                  <template v-else-if="walletAddress && canFill && !canSignTransactions">
                    <p class="escrow-modal__cannot-fill">
                      Your wallet does not support signing transactions. Try another wallet.
                    </p>
                    <Button
                      variant="primary"
                      class="escrow-modal__fill-btn"
                      @click="openConnectModal"
                    >
                      Change wallet
                    </Button>
                  </template>
                  <p v-else-if="walletAddress && !canFill" class="escrow-modal__cannot-fill">
                    You cannot fill this trade (restrictions or expired).
                  </p>
                  <Button
                    v-else
                    variant="primary"
                    class="escrow-modal__fill-btn"
                    @click="openConnectModal"
                  >
                    Connect wallet
                  </Button>
                </div>
              </div>
            </section>

            <!-- Collapsible details (filler only): 2-col with QR in second column -->
            <section v-if="!isMaker" class="escrow-modal__details">
              <button
                type="button"
                class="escrow-modal__details-toggle"
                :aria-expanded="detailsOpen"
                @click="detailsOpen = !detailsOpen"
              >
                <span>Details</span>
                <Icon :icon="detailsOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
              </button>
              <div v-show="detailsOpen" class="escrow-modal__details-content">
                <div class="escrow-modal__details-cols">
                  <div class="escrow-modal__details-col-left">
                    <dl class="escrow-modal__details-list">
                      <dt>Escrow</dt>
                      <dd>
                        <code>{{ truncateAddress(props.escrowId ?? '', 8, 8) }}</code>
                        <a v-if="props.escrowId" :href="explorerLinks.accountUrl(props.escrowId)" target="_blank" rel="noopener" class="escrow-modal__link" title="View on Solscan"><Icon icon="mdi:open-in-new" /></a>
                        <button type="button" class="escrow-modal__copy" aria-label="Copy escrow address" @click="copyToClipboard(props.escrowId ?? '', 'Escrow address')"><Icon icon="mdi:content-copy" /></button>
                      </dd>
                      <dt>Maker</dt>
                      <dd>
                        <code>{{ truncateAddress(escrow.account.maker.toBase58(), 8, 8) }}</code>
                        <a :href="explorerLinks.accountUrl(escrow.account.maker.toBase58())" target="_blank" rel="noopener" class="escrow-modal__link" title="View on Solscan"><Icon icon="mdi:open-in-new" /></a>
                        <button type="button" class="escrow-modal__copy" aria-label="Copy maker address" @click="copyToClipboard(escrow.account.maker.toBase58(), 'Maker address')"><Icon icon="mdi:content-copy" /></button>
                      </dd>
                      <dt>Deposit token</dt>
                      <dd>
                        <code>{{ truncateAddress(escrow.account.depositToken.toBase58(), 8, 8) }}</code>
                        <a :href="explorerLinks.tokenUrl(escrow.account.depositToken.toBase58())" target="_blank" rel="noopener" class="escrow-modal__link" title="View on Solscan"><Icon icon="mdi:open-in-new" /></a>
                        <button type="button" class="escrow-modal__copy" aria-label="Copy mint" @click="copyToClipboard(escrow.account.depositToken.toBase58(), 'Deposit token mint')"><Icon icon="mdi:content-copy" /></button>
                      </dd>
                      <dt>Request token</dt>
                      <dd>
                        <code>{{ truncateAddress(escrow.account.requestToken.toBase58(), 8, 8) }}</code>
                        <a :href="explorerLinks.tokenUrl(escrow.account.requestToken.toBase58())" target="_blank" rel="noopener" class="escrow-modal__link" title="View on Solscan"><Icon icon="mdi:open-in-new" /></a>
                        <button type="button" class="escrow-modal__copy" aria-label="Copy mint" @click="copyToClipboard(escrow.account.requestToken.toBase58(), 'Request token mint')"><Icon icon="mdi:content-copy" /></button>
                      </dd>
                      <dt>Price (chain)</dt>
                      <dd><code>{{ escrow.account.price }}</code></dd>
                      <dt>Remaining (deposit)</dt>
                      <dd>
                        <TokenAmountWithLabel v-if="display" :amount="display.depositAmount" :decimals="display.depositDecimals" :symbol="display.depositSymbol" :name="display.depositName" :mint="escrow.account.depositToken.toBase58()" :show-mint-short="false" />
                      </dd>
                      <dt>Recipient</dt>
                      <dd>{{ isPublicRecipient ? 'Any wallet' : truncateAddress(escrow.account.recipient.toBase58(), 8, 8) }}</dd>
                    </dl>
                  </div>
                  <div class="escrow-modal__details-col-right">
                    <div v-if="shareUrlValue" class="escrow-modal__owner-qr">
                      <img v-if="shareQrDataUrl" :src="shareQrDataUrl" alt="QR code" class="escrow-modal__owner-qr-img" />
                    </div>
                    <div class="escrow-modal__owner-link-row">
                      <input :value="shareUrlValue" type="text" readonly class="escrow-modal__owner-input" />
                      <button type="button" class="escrow-modal__owner-copy" aria-label="Copy link" @click="copyShareLinkAndNotify">
                        <Icon icon="mdi:content-copy" />
                      </button>
                    </div>
                    <dl class="escrow-modal__details-list escrow-modal__details-list--rest">
                      <dt>Whitelist only</dt>
                      <dd>{{ escrow.account.onlyWhitelist ? 'Yes' : 'No' }}</dd>
                      <dt>Partial fill</dt>
                      <dd>{{ escrow.account.allowPartialFill ? 'Yes' : 'No' }}</dd>
                      <dt>Expires</dt>
                      <dd>{{ expireLabel }}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { Button, TokenAmountWithLabel, StatusBanner } from '@decentraguild/ui/components'
import { truncateAddress, toRawUnits, sanitizeTokenLabel, escrowPriceToHuman } from '@decentraguild/display'
import { useEscrowDisplay } from '~/composables/useEscrowDisplay'
import { useTenantStore } from '~/stores/tenant'
import { API_V1 } from '~/utils/apiBase'
import { useApiBase } from '~/composables/useApiBase'
import { useMarketplaceEscrowLinks } from '~/composables/useMarketplaceEscrowLinks'
import { useAuth } from '@decentraguild/auth'
import {
  fetchEscrowByAddress,
  buildCancelTransaction,
  buildExchangeTransaction,
  sendAndConfirmTransaction,
  getEscrowWalletFromConnector,
} from '@decentraguild/web3'
import { ESCROW_PROGRAM_ID } from '@decentraguild/contracts'
import { Connection, SystemProgram, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { useRpc } from '~/composables/useRpc'
import { useExplorerLinks } from '~/composables/useExplorerLinks'
import { useTransactionNotificationsStore } from '~/stores/transactionNotifications'
import { fetchWalletTokenBalances, type TokenBalance } from '~/composables/useWalletTokenBalances'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    escrowId: string | null
    fillDisabled?: boolean
  }>(),
  { fillDisabled: false }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const tenantStore = useTenantStore()
const { slug } = storeToRefs(tenantStore)
const { shareUrl: getShareUrl } = useMarketplaceEscrowLinks(slug)
const auth = useAuth()
const openConnectModal = auth.openConnectModal
const { rpcUrl, rpcError } = useRpc()
const txNotifications = useTransactionNotificationsStore()
const apiBase = useApiBase()
const explorerLinks = useExplorerLinks()

const apiAvailable = computed(() => Boolean(apiBase.value && slug.value))

const escrow = ref<Awaited<ReturnType<typeof fetchEscrowByAddress>> | null>(null)
const loading = ref(true)
const filling = ref(false)
const cancelling = ref(false)
const detailsOpen = ref(false)
const ownerFillOpen = ref(false)
const ratioFlipped = ref(false)
const fillPercent = ref(100)
const fillAmountInput = ref('')
const fillAmountInputFocused = ref(false)
const walletBalances = ref<TokenBalance[]>([])
const shareQrDataUrl = ref('')

const shareUrlValue = computed(() =>
  props.escrowId ? getShareUrl(props.escrowId) : ''
)

async function copyShareLinkAndNotify() {
  const url = shareUrlValue.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    notifyCopied('Link')
  } catch {
    // ignore
  }
}

const SYSTEM_PROGRAM = '11111111111111111111111111111111'

interface EscrowApiShape {
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

function apiEscrowToFull(e: EscrowApiShape) {
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

const walletAddress = computed(() => auth.connectorState.value?.account ?? null)
/** True only when the connector can actually sign transactions (not just "connected"). Re-runs when connectorState changes. */
const canSignTransactions = computed(() => {
  const _ = auth.connectorState.value
  return getEscrowWalletFromConnector() != null
})
const isMaker = computed(
  () =>
    escrow.value &&
    walletAddress.value &&
    escrow.value.account.maker.toBase58() === walletAddress.value
)

const isPublicRecipient = computed(() => {
  if (!escrow.value) return true
  const rec = escrow.value.account.recipient.toBase58()
  return rec === SYSTEM_PROGRAM
})

const expireLabel = computed(() => {
  if (!escrow.value) return 'Never'
  const ts = escrow.value.account.expireTimestamp?.toNumber?.() ?? 0
  if (ts <= 0) return 'Never'
  const date = new Date(ts * 1000)
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})

const canFill = computed(() => {
  if (!escrow.value || !walletAddress.value) return false
  if (escrow.value.account.maker.toBase58() === walletAddress.value) return false
  if ((escrow.value.account.tokensDepositRemaining?.toNumber() ?? 0) <= 0) return false
  if (escrow.value.account.onlyWhitelist) return false
  if (escrow.value.account.onlyRecipient) {
    const rec = escrow.value.account.recipient.toBase58()
    if (rec !== SYSTEM_PROGRAM && rec !== walletAddress.value) return false
  }
  const ts = escrow.value.account.expireTimestamp?.toNumber?.() ?? 0
  if (ts > 0 && ts < Math.floor(Date.now() / 1000)) return false
  return true
})

const { data } = useEscrowDisplay(escrow)
const display = computed(() => data.value)

/** Chain price (human per unit). Use this for Rate and You pay so they match Details. */
const chainPrice = computed(() => {
  const p = escrow.value?.account?.price
  return p != null && Number.isFinite(p) ? Number(p) : 0
})

const sanitizedDepositSymbol = computed(() =>
  display.value ? sanitizeTokenLabel(display.value.depositSymbol ?? display.value.depositMintShort) || display.value.depositMintShort : ''
)
const sanitizedPriceSymbol = computed(() =>
  display.value ? sanitizeTokenLabel(display.value.priceSymbol ?? display.value.requestMintShort) || display.value.requestMintShort : ''
)
const sanitizedDepositName = computed(() =>
  display.value ? sanitizeTokenLabel(display.value.depositName ?? display.value.depositSymbol) || 'Deposit' : 'Deposit'
)
const sanitizedRequestName = computed(() =>
  display.value ? sanitizeTokenLabel(display.value.requestName ?? display.value.priceSymbol) || 'Request' : 'Request'
)

const fillDepositAmount = computed(() => {
  if (!display.value) return 0
  return (display.value.depositAmount * fillPercent.value) / 100
})

function formatFillAmountForInput(amount: number, decimals: number): string {
  if (amount === 0) return '0'
  if (decimals === 0) return String(Math.round(amount))
  return amount.toFixed(decimals).replace(/\.?0+$/, '')
}

function syncFillAmountInputFromPercent() {
  if (display.value) {
    fillAmountInput.value = formatFillAmountForInput(
      fillDepositAmount.value,
      display.value.depositDecimals
    )
  }
}

function onFillAmountInput() {
  const d = display.value
  if (!d || d.depositAmount <= 0) return
  const parsed = parseFloat(fillAmountInput.value)
  if (Number.isNaN(parsed) || parsed < 0) return
  const pct = Math.min(100, Math.max(0, (parsed / d.depositAmount) * 100))
  fillPercent.value = pct
}

const fillRequestAmount = computed(() => {
  if (!display.value) return 0
  return fillDepositAmount.value * chainPrice.value
})

function rawAmountDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return '0'
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(6).replace(/\.?0+$/, '')
}

const fillRequestAmountDisplay = computed(() => rawAmountDisplay(fillRequestAmount.value))
const fillDepositAmountDisplay = computed(() => rawAmountDisplay(fillDepositAmount.value))

const requestTokenBalance = computed(() => {
  if (!escrow.value) return 0
  const mint = escrow.value.account.requestToken.toBase58()
  const b = walletBalances.value.find((x) => x.mint === mint)
  return b?.uiAmount ?? 0
})

const insufficientBalance = computed(() => {
  if (!canFill.value || !display.value) return false
  return requestTokenBalance.value < fillRequestAmount.value
})

const escrowMints = computed(() => {
  if (!escrow.value) return new Set<string>()
  return new Set([
    escrow.value.account.depositToken.toBase58(),
    escrow.value.account.requestToken.toBase58(),
  ])
})

function close() {
  emit('update:modelValue', false)
}

function notifyCopied(label: string) {
  const id = `copy-${Date.now()}`
  txNotifications.add(id, { status: 'success', message: `Copied: ${label}` })
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    notifyCopied(label)
  } catch {
    // ignore
  }
}

async function handleFill() {
  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey || !escrow.value || !props.escrowId) {
    const id = `fill-error-${Date.now()}`
    txNotifications.add(id, {
      status: 'error',
      message: walletAddress.value
        ? 'Wallet cannot sign transactions. Try reconnecting or use another wallet.'
        : 'Connect a wallet to fill this trade.',
    })
    return
  }
  const depDecimals = display.value?.depositDecimals ?? 0
  const amountRaw = toRawUnits(fillDepositAmount.value, depDecimals)
  const amountBN = new BN(amountRaw)
  if (amountBN.lte(new BN(0))) {
    txNotifications.add(`fill-amount-${Date.now()}`, {
      status: 'error',
      message: 'Enter a valid amount to fill.',
    })
    return
  }

  filling.value = true
  const txId = `fill-${props.escrowId}-${Date.now()}`
  txNotifications.add(txId, { status: 'pending', message: 'Filling escrow...' })
  try {
    const connection = new Connection(rpcUrl.value)
    const whitelistKey = escrow.value.account.whitelist
    const escrowProgramId = new PublicKey(ESCROW_PROGRAM_ID)
    const hasWhitelist =
      whitelistKey &&
      !whitelistKey.equals(SystemProgram.programId) &&
      !whitelistKey.equals(escrowProgramId)
    const tx = await buildExchangeTransaction({
      maker: escrow.value.account.maker,
      taker: wallet.publicKey,
      depositTokenMint: escrow.value.account.depositToken,
      requestTokenMint: escrow.value.account.requestToken,
      amount: amountBN,
      seed: escrow.value.account.seed,
      connection,
      wallet,
      whitelist: hasWhitelist ? whitelistKey.toBase58() : null,
    })
    const sig = await sendAndConfirmTransaction(connection, tx, wallet, wallet.publicKey)
    txNotifications.update(txId, { status: 'success', message: 'Escrow filled', signature: sig })
    escrow.value = null
    close()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fill failed'
    txNotifications.update(txId, {
      status: 'error',
      message: msg,
    })
  } finally {
    filling.value = false
  }
}

async function handleCancel() {
  const wallet = getEscrowWalletFromConnector()
  if (!wallet || !escrow.value || !props.escrowId) return
  cancelling.value = true
  const txId = `cancel-${props.escrowId}-${Date.now()}`
  txNotifications.add(txId, { status: 'pending', message: 'Cancelling escrow...' })
  try {
    const connection = new Connection(rpcUrl.value)
    const tx = await buildCancelTransaction({
      maker: escrow.value.account.maker,
      depositTokenMint: escrow.value.account.depositToken,
      requestTokenMint: escrow.value.account.requestToken,
      seed: escrow.value.account.seed,
      connection,
      wallet,
    })
    const sig = await sendAndConfirmTransaction(
      connection,
      tx,
      wallet,
      escrow.value.account.maker
    )
    txNotifications.update(txId, { status: 'success', message: 'Escrow cancelled', signature: sig })
    escrow.value = null
    close()
  } catch (e) {
    txNotifications.update(txId, {
      status: 'error',
      message: e instanceof Error ? e.message : 'Cancel failed',
    })
  } finally {
    cancelling.value = false
  }
}

async function loadEscrow(id: string) {
  if (!id) return
  loading.value = true
  escrow.value = null
  fillPercent.value = 100
  try {
    const base = apiBase.value
    const tenantSlug = slug.value
    if (base && tenantSlug) {
      const url = `${base}${API_V1}/tenant/${encodeURIComponent(tenantSlug)}/marketplace/escrows/${encodeURIComponent(id)}`
      const res = await fetch(url)
      if (res.ok) {
        const json = (await res.json()) as { escrow?: EscrowApiShape }
        if (json.escrow) escrow.value = apiEscrowToFull(json.escrow)
      }
    }
    if (!escrow.value && rpcUrl.value) {
      const connection = new Connection(rpcUrl.value)
      const fromChain = await fetchEscrowByAddress(connection, id)
      escrow.value = fromChain
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) auth.refreshConnectorState()
  }
)
watch(
  () => [props.escrowId, slug.value, apiBase.value] as const,
  ([id, tenantSlug, base]) => {
    if (id && tenantSlug && base) void loadEscrow(id)
    else escrow.value = null
  },
  { immediate: true }
)

watch(
  [fillPercent, display],
  () => {
    if (!fillAmountInputFocused.value && display.value) {
      syncFillAmountInputFromPercent()
    }
  },
  { immediate: true }
)

watch(
  [walletAddress, rpcUrl, escrowMints],
  async () => {
    if (!walletAddress.value || !rpcUrl.value || escrowMints.value.size === 0) {
      walletBalances.value = []
      return
    }
    try {
      walletBalances.value = await fetchWalletTokenBalances(
        rpcUrl.value,
        walletAddress.value,
        escrowMints.value
      )
    } catch {
      walletBalances.value = []
    }
  },
  { immediate: true }
)

watch(
  () => [props.modelValue, props.escrowId, shareUrlValue.value] as const,
  async ([open, id, url]) => {
    if (!open || !id || !url) {
      shareQrDataUrl.value = ''
      return
    }
    try {
      const QRCode = await import('qrcode')
      shareQrDataUrl.value = await QRCode.toDataURL(url, { width: 200, margin: 1 })
    } catch {
      shareQrDataUrl.value = ''
    }
  },
  { immediate: true }
)

</script>

<style scoped>
.escrow-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--theme-space-md);
}

.escrow-modal {
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  box-shadow: var(--theme-shadow-card);
  --escrow-modal-width: 42rem;
  max-width: min(90vw, var(--escrow-modal-width));
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--theme-space-xl);
}

.escrow-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--theme-space-lg);
  padding-bottom: var(--theme-space-md);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.escrow-modal__title {
  margin: 0;
  font-size: var(--theme-font-xl);
  font-weight: 600;
  color: var(--theme-text-primary);
}

.escrow-modal__header-actions {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
}

.escrow-modal__icon-btn {
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
}

.escrow-modal__icon-btn:hover {
  color: var(--theme-text-primary);
}

.escrow-modal__close {
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
}

.escrow-modal__close:hover {
  color: var(--theme-text-primary);
}

.escrow-modal__rpc-hint {
  margin-top: var(--theme-space-sm);
  font-size: var(--theme-font-sm);
  opacity: 0.9;
}

.escrow-modal__body {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-lg);
}

.escrow-modal__owner {
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  padding: var(--theme-space-lg);
}

.escrow-modal__section-title {
  margin-top: 0;
}

.escrow-modal__owner .escrow-modal__section-title {
  margin-top: var(--theme-space-lg);
}

.escrow-modal__owner .escrow-modal__section-title:first-child {
  margin-top: 0;
}

.escrow-modal__details-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--theme-space-lg);
  align-items: start;
}

@media (max-width: var(--theme-breakpoint-xs)) {
  .escrow-modal__details-cols {
    grid-template-columns: 1fr;
  }
}

.escrow-modal__details-col-left {
  min-width: 0;
}

.escrow-modal__details-col-right {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.escrow-modal__owner-qr {
  display: flex;
  justify-content: center;
  padding: var(--theme-space-md);
  background: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-md);
}

.escrow-modal__owner-qr-img {
  width: 200px;
  height: 200px;
  display: block;
}

.escrow-modal__owner-link-row {
  display: flex;
  gap: var(--theme-space-sm);
  align-items: center;
}

.escrow-modal__owner-input {
  flex: 1;
  min-width: 0;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  font-family: ui-monospace, monospace;
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-primary);
}

.escrow-modal__owner-copy {
  flex-shrink: 0;
  padding: var(--theme-space-sm) var(--theme-space-md);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.escrow-modal__owner-copy:hover {
  color: var(--theme-text-primary);
  border-color: var(--theme-primary);
}

.escrow-modal__details-list--rest {
  margin: 0;
}

.escrow-modal__owner-actions {
  margin-top: var(--theme-space-md);
  margin-bottom: 0;
}

.escrow-modal__fill {
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  padding: var(--theme-space-lg);
}

.escrow-modal__section-title {
  margin: 0 0 var(--theme-space-md);
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
}

.escrow-modal__fill-loading,
.escrow-modal__fill-winding-down {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.escrow-modal__fill-winding-down {
  padding: var(--theme-space-sm);
  background: var(--theme-status-warning, #ecc94b);
  color: var(--theme-text-primary);
}

.escrow-modal__fill-amount-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--theme-space-xs);
}

.escrow-modal__label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.escrow-modal__balance-inline {
  display: flex;
  align-items: baseline;
  gap: var(--theme-space-xs);
  font-size: var(--theme-font-sm);
}

.escrow-modal__balance-label {
  color: var(--theme-text-muted);
}

.escrow-modal__balance-placeholder {
  color: var(--theme-text-muted);
}

.escrow-modal__slider-row {
  display: flex;
  align-items: center;
  gap: var(--theme-space-md);
  margin-bottom: var(--theme-space-sm);
}

.escrow-modal__range {
  flex: 1;
  height: 0.5rem;
  accent-color: var(--theme-primary);
  cursor: pointer;
}

.escrow-modal__range:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.escrow-modal__slider-value {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  color: var(--theme-text-primary);
  min-width: 2.5rem;
}

.escrow-modal__fill-amount-input-row {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  margin-top: var(--theme-space-sm);
}

.escrow-modal__fill-amount-input {
  width: 8rem;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-primary);
}

.escrow-modal__fill-amount-input:focus {
  outline: none;
  border-color: var(--theme-primary);
}

.escrow-modal__fill-amount-token {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.escrow-modal__rate {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-md);
}

.escrow-modal__rate-label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  flex-shrink: 0;
}

.escrow-modal__rate-value {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-xs) var(--theme-space-sm);
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-primary);
  font-size: var(--theme-font-sm);
  cursor: pointer;
}

.escrow-modal__rate-value:hover {
  border-color: var(--theme-primary);
}

.escrow-modal__rate-approx {
  color: var(--theme-text-muted);
  margin: 0 var(--theme-space-xs);
}

.escrow-modal__rate-icon {
  font-size: 1rem;
  color: var(--theme-text-muted);
}


.escrow-modal__insufficient {
  margin: 0 auto var(--theme-space-sm);
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
  text-align: center;
  width: 30%;
}

.escrow-modal__fill-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--theme-space-md);
}

.escrow-modal__fill-btn {
  width: 30%;
  min-width: 8rem;
}

.escrow-modal__cannot-fill {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  text-align: center;
  width: 30%;
}

.escrow-modal__balance-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: var(--theme-font-sm);
  margin-bottom: var(--theme-space-sm);
}

.escrow-modal__balance-label {
  color: var(--theme-text-muted);
}

.escrow-modal__pay-receive {
  background: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-sm);
  padding: var(--theme-space-md);
  margin-bottom: var(--theme-space-md);
}

.escrow-modal__pay-receive-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: var(--theme-font-sm);
}

.escrow-modal__pay-receive-row + .escrow-modal__pay-receive-row {
  margin-top: var(--theme-space-xs);
}

.escrow-modal__pay-receive-label {
  color: var(--theme-text-secondary);
}

.escrow-modal__pay-receive-value {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.escrow-modal__pay-receive-token {
  font-weight: 400;
  color: var(--theme-text-muted);
  margin-left: var(--theme-space-xs);
}

.escrow-modal__insufficient {
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
  margin-bottom: var(--theme-space-sm);
}

.escrow-modal__fill-actions {
  margin-top: var(--theme-space-md);
}

.escrow-modal__actions {
  display: flex;
  gap: var(--theme-space-sm);
  flex-wrap: wrap;
}

.escrow-modal__details {
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  overflow: hidden;
}

.escrow-modal__details-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-md) var(--theme-space-lg);
  background: var(--theme-bg-secondary);
  border: none;
  color: var(--theme-text-primary);
  font-size: var(--theme-font-sm);
  font-weight: 500;
  cursor: pointer;
}

.escrow-modal__details-toggle:hover {
  background: var(--theme-bg-card);
}

.escrow-modal__details-content {
  padding: var(--theme-space-lg);
  background: var(--theme-bg-primary);
}

.escrow-modal__details-list {
  margin: 0;
  font-size: var(--theme-font-sm);
}

.escrow-modal__details-list dt {
  margin-top: var(--theme-space-sm);
  color: var(--theme-text-muted);
  font-weight: 500;
}

.escrow-modal__details-list dt:first-child {
  margin-top: 0;
}

.escrow-modal__details-list dd {
  margin: var(--theme-space-xs) 0 0;
  color: var(--theme-text-primary);
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
}

.escrow-modal__details-list code {
  font-family: ui-monospace, monospace;
  font-size: var(--theme-font-xs);
}

.escrow-modal__link {
  color: var(--theme-primary);
  padding: var(--theme-space-xs);
}

.escrow-modal__link:hover {
  color: var(--theme-primary-hover);
}

.escrow-modal__copy {
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-muted);
  cursor: pointer;
}

.escrow-modal__copy:hover {
  color: var(--theme-text-primary);
}
</style>
