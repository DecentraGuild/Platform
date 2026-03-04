<template>
  <div class="admin__split">
    <div class="admin__panel">
      <Card>
        <h3>Default whitelist for raffles</h3>
        <p class="admin__hint">Use dGuild default, public, or a specific list. Applies to all raffles. Set to Public to allow per-raffle whitelist selection.</p>
        <WhitelistSelect
          :slug="slug"
          :model-value="whitelistFormValue"
          label="Whitelist"
          show-use-default
          :disabled="savingWhitelist"
          @update:model-value="onWhitelistUpdate"
        />
        <div class="admin__panel-actions">
          <Button
            variant="primary"
            :disabled="savingWhitelist || !whitelistDirty"
            @click="saveWhitelist"
          >
            {{ savingWhitelist ? 'Saving...' : 'Save default whitelist' }}
          </Button>
          <p v-if="whitelistSaveSuccess" class="admin__success">Saved.</p>
          <p v-if="whitelistSaveError" class="admin__error">{{ whitelistSaveError }}</p>
        </div>
      </Card>

      <div class="raffle-slots">
        <h3>Raffle slots</h3>
        <p class="admin__hint">Each slot holds one raffle. Click the plus to create a new raffle in that slot.</p>
        <p v-if="actionTxStatus" class="raffle-slots__tx-status">
          <Icon icon="mdi:loading" class="raffle-slots__tx-spinner" />
          {{ actionTxStatus }}
        </p>
        <div v-if="slotsLoading" class="raffle-slots__loading">
          <Icon icon="mdi:loading" class="raffle-slots__spinner" />
          <span>Loading...</span>
        </div>
        <div v-else class="raffle-slots__grid">
          <template v-for="(slot, idx) in slotCards" :key="slot.key">
            <RaffleSlotCard
              v-if="slot.raffle"
              :slot="slot"
              :action-submitting="actionSubmitting"
              :action-error="actionError"
              :action-error-raffle="actionErrorRaffle"
              :mint-metadata-by-ticket-mint="mintMetadataByTicketMint"
              @add-reward="openAddRewardModal(slot.raffle!)"
              @start="openStartRaffleModal(slot)"
              @pause="onPauseRaffle(slot)"
              @resume="onResumeRaffle(slot)"
              @edit="openEditRaffleModal(slot)"
              @reveal-winner="onRevealWinner(slot)"
              @distribute-reward="onDistributeReward(slot)"
              @claim-proceeds="onClaimProceeds(slot)"
              @close="onCloseRaffle(slot.raffle!)"
            />
            <button
              v-else
              type="button"
              class="raffle-slot-card raffle-slot-card--empty"
              :disabled="!canCreateMore"
              @click="openCreateModal(idx)"
            >
              <Icon icon="mdi:plus" class="raffle-slot-card__plus" />
              <span class="raffle-slot-card__label">Create raffle</span>
            </button>
          </template>
          <button
            type="button"
            class="raffle-slot-card raffle-slot-card--upgrade"
            @click="openUpgradeModal"
          >
            <Icon icon="mdi:arrow-up-bold" class="raffle-slot-card__upgrade-icon" />
            <span class="raffle-slot-card__upgrade-label">Upgrade tier</span>
            <span class="raffle-slot-card__upgrade-hint">More included slots</span>
          </button>
        </div>
      </div>
    </div>

    <div id="raffle-pricing-widget" class="raffle-pricing-wrapper">
    <AdminPricingWidget
      ref="pricingRef"
      module-id="raffles"
      :module-state="moduleState"
      :conditions="liveConditions"
      :subscription="subscription"
      :saving="saving"
      :deploying="deploying"
      :save-error="saveError"
      @save="(p: BillingPeriod) => emit('save', p, upgradeConditionsOverride ?? undefined)"
      @deploy="(p: BillingPeriod) => emit('deploy', p, upgradeConditionsOverride ?? undefined)"
    />
    </div>

    <Modal
      :model-value="showUpgradeModal"
      title="Unlock more slots"
      @update:model-value="showUpgradeModal = false"
    >
      <div v-if="showUpgradeModal" class="raffle-upgrade-modal">
        <p class="raffle-upgrade-modal__hint">Choose a plan to get more raffle slots. The pricing panel will update.</p>
        <div class="raffle-upgrade-modal__options">
          <button
            type="button"
            class="raffle-upgrade-option"
            :class="{ 'raffle-upgrade-option--current': effectiveTierId === 'grow', 'raffle-upgrade-option--disabled': effectiveTierId === 'grow' }"
            :disabled="effectiveTierId === 'grow'"
            @click="effectiveTierId !== 'grow' && selectUpgradeTier('grow')"
          >
            <span class="raffle-upgrade-option__name">Grow</span>
            <span class="raffle-upgrade-option__slots">3 slots</span>
            <span class="raffle-upgrade-option__price">15 USDC/mo</span>
            <span v-if="effectiveTierId === 'grow'" class="raffle-upgrade-option__badge">Current</span>
          </button>
          <button
            type="button"
            class="raffle-upgrade-option"
            :class="{ 'raffle-upgrade-option--current': effectiveTierId === 'pro', 'raffle-upgrade-option--disabled': effectiveTierId === 'pro' }"
            :disabled="effectiveTierId === 'pro'"
            @click="effectiveTierId !== 'pro' && selectUpgradeTier('pro')"
          >
            <span class="raffle-upgrade-option__name">Pro</span>
            <span class="raffle-upgrade-option__slots">10 slots included</span>
            <span class="raffle-upgrade-option__price">25 USDC/mo + 5 USDC/mo per extra active slot</span>
            <span v-if="effectiveTierId === 'pro'" class="raffle-upgrade-option__badge">Current</span>
          </button>
        </div>
        <p class="raffle-upgrade-modal__note">Scroll down to select monthly/yearly and pay.</p>
      </div>
    </Modal>

    <Modal
      :model-value="showAddRewardModal"
      title="Add reward"
      wide
      @update:model-value="showAddRewardModal = false"
    >
      <form v-if="showAddRewardModal && selectedRaffleForReward" class="raffle-add-reward-form" @submit.prevent="onAddRewardSubmit">
        <TextInput
          v-model="addRewardForm.prizeMint"
          label="Prize token mint"
          placeholder="SPL token mint address"
          required
        />
        <TextInput
          v-model="addRewardForm.amountDisplay"
          type="number"
          :label="prizeMintMeta.label"
          :placeholder="prizeMintMeta.placeholder"
          required
        />
        <p v-if="prizeMintMeta.hint" class="raffle-add-reward-form__hint">{{ prizeMintMeta.hint }}</p>
        <TextInput
          v-model="addRewardForm.imageUrl"
          label="Image URL (optional)"
          placeholder="https://..."
        />
        <p v-if="addRewardError" class="raffle-add-reward-form__error">{{ addRewardError }}</p>
        <div class="raffle-add-reward-form__actions">
          <Button variant="secondary" type="button" @click="showAddRewardModal = false">
            Cancel
          </Button>
          <Button variant="primary" type="submit" :disabled="addRewardSubmitting">
            {{ addRewardSubmitting ? 'Adding...' : 'Add reward' }}
          </Button>
        </div>
      </form>
    </Modal>

    <Modal
      :model-value="showStartRaffleModal"
      title="Start raffle"
      @update:model-value="onCancelStartRaffle"
    >
      <div v-if="showStartRaffleModal && selectedRaffleForStart" class="raffle-start-modal">
        <p class="raffle-start-modal__warning">
          Starting the raffle will finalise it. You will not be able to cancel from this point. Users can buy tickets once started.
        </p>
        <p v-if="selectedRaffleForStart.chainData?.name" class="raffle-start-modal__name">{{ selectedRaffleForStart.chainData.name }}</p>
        <div class="raffle-start-modal__actions">
          <Button variant="secondary" type="button" @click="onCancelStartRaffle">Cancel</Button>
          <Button variant="primary" type="button" @click="onConfirmStartRaffle">Start raffle</Button>
        </div>
      </div>
    </Modal>

    <Modal
      :model-value="showEditRaffleModal"
      title="Edit raffle"
      wide
      @update:model-value="showEditRaffleModal = false"
    >
      <form v-if="showEditRaffleModal && selectedRaffleForEdit" class="raffle-edit-form" @submit.prevent="onEditRaffleSubmit">
        <p class="raffle-edit-form__hint">You can only edit name, description and image when the raffle is paused.</p>
        <TextInput v-model="editForm.name" label="Name" placeholder="Raffle name" required />
        <TextInput v-model="editForm.description" label="Description" placeholder="Brief description" />
        <TextInput v-model="editForm.url" label="Image URL" placeholder="https://..." />
        <div class="raffle-edit-form__actions">
          <Button variant="secondary" type="button" @click="showEditRaffleModal = false">Cancel</Button>
          <Button variant="primary" type="submit" :disabled="actionSubmitting === selectedRaffleForEdit?.raffle?.rafflePubkey">
            Save
          </Button>
        </div>
      </form>
    </Modal>

    <Modal
      :model-value="showCreateModal"
      title="Create raffle"
      wide
      @update:model-value="showCreateModal = false"
    >
      <form v-if="showCreateModal" class="raffle-create-form" @submit.prevent="onCreateSubmit">
        <TextInput
          v-model="createForm.name"
          label="Name"
          placeholder="Raffle name"
          required
        />
        <TextInput
          v-model="createForm.description"
          label="Description"
          placeholder="Brief description"
        />
        <TextInput
          v-model="createForm.ticketMint"
          label="Ticket token mint"
          placeholder="SPL token mint address"
          required
        />
        <TextInput
          v-model="createForm.ticketPriceDisplay"
          type="number"
          :label="createTicketMeta.label"
          :placeholder="createTicketMeta.placeholder"
        />
        <p v-if="createTicketMeta.hint" class="raffle-create-form__hint">{{ createTicketMeta.hint }}</p>
        <TextInput
          v-model="createForm.maxTicketsDisplay"
          type="number"
          label="Max tickets"
          placeholder="e.g. 100"
          required
        />
        <WhitelistSelect
          v-if="isDefaultWhitelistPublic"
          :slug="slug"
          :model-value="createForm.whitelist"
          label="Whitelist (this raffle)"
          show-use-default
          @update:model-value="createForm.whitelist = $event"
        />
        <p v-if="createError" class="raffle-create-form__error">{{ createError }}</p>
        <div class="raffle-create-form__actions">
          <Button variant="secondary" type="button" @click="showCreateModal = false">
            Cancel
          </Button>
          <Button variant="primary" type="submit" :disabled="createSubmitting">
            {{ createSubmitting ? 'Creating...' : 'Create raffle' }}
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { ModuleState } from '@decentraguild/core'
import type { BillingPeriod, ConditionSet } from '@decentraguild/billing'
import { Card, Button, TextInput, Modal } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import WhitelistSelect from '~/components/WhitelistSelect.vue'
import AdminPricingWidget from '~/components/AdminPricingWidget.vue'
import RaffleSlotCard from '~/components/admin/RaffleSlotCard.vue'
import { useTenantStore } from '~/stores/tenant'
import { nextTick, watch } from 'vue'
import { usePricePreview } from '~/composables/usePricePreview'
import { useMintMetadata } from '~/composables/useMintMetadata'
import { useMintMetadataForInput } from '~/composables/useMintMetadataForInput'
import { useAdminRaffleActions } from '~/composables/useAdminRaffleActions'
import { toRef } from 'vue'
import { getEffectiveWhitelist } from '@decentraguild/core'
import {
  getEscrowWalletFromConnector,
  buildBillingTransfer,
  buildInitializeRaffleTransaction,
  buildPrepareRaffleTransaction,
  buildCloseRaffleTransaction,
  buildEnableRaffleTransaction,
  buildDisableRaffleTransaction,
  buildEditRaffleTransaction,
  buildRevealWinnersTransaction,
  buildClaimPrizeTransaction,
  buildClaimTicketsTransaction,
  deriveRafflePda,
  fetchRaffleChainData,
} from '@decentraguild/web3'
import { PublicKey, Transaction } from '@solana/web3.js'
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import type { RaffleChainData } from '@decentraguild/web3'
import { useSolanaConnection } from '~/composables/useSolanaConnection'
import { API_V1 } from '~/utils/apiBase'

const props = defineProps<{
  slug: string
  moduleState: ModuleState
  subscription: { periodEnd?: string; selectedTierId?: string } | null
  saving?: boolean
  deploying?: boolean
  saveError?: string | null
}>()

const emit = defineEmits<{
  save: [period: BillingPeriod, conditions?: ConditionSet]
  deploy: [period: BillingPeriod, conditions?: ConditionSet]
}>()

const tenantStore = useTenantStore()
const apiBase = useApiBase()
const { connection } = useSolanaConnection()

interface RaffleItem {
  id: string
  rafflePubkey: string
  createdAt: string
  closedAt: string | null
}

interface SlotCard {
  key: string
  raffle: RaffleItem | null
  chainData: RaffleChainData | null
}

const conditions = ref<ConditionSet | null>(null)
const raffles = ref<RaffleItem[]>([])
const slotsLoading = ref(true)
const showCreateModal = ref(false)
const showUpgradeModal = ref(false)
const showAddRewardModal = ref(false)
const selectedRaffleForReward = ref<RaffleItem | null>(null)
const addRewardSubmitting = ref(false)
const addRewardError = ref<string | null>(null)
const showStartRaffleModal = ref(false)
const selectedRaffleForStart = ref<SlotCard | null>(null)
const showEditRaffleModal = ref(false)
const selectedRaffleForEdit = ref<SlotCard | null>(null)
const editForm = reactive({ name: '', description: '', url: '' })
const addRewardForm = reactive({
  prizeMint: '',
  amountDisplay: '',
  imageUrl: '',
})
const upgradeConditionsOverride = ref<ConditionSet | null>(null)
const createSubmitting = ref(false)
const createError = ref<string | null>(null)

const createForm = reactive({
  name: '',
  description: '',
  ticketMint: '',
  ticketPriceDisplay: '',
  maxTicketsDisplay: '100',
  whitelist: null as { programId: string; account: string } | null | 'use-default',
})

const createTicketMeta = useMintMetadataForInput(
  toRef(createForm, 'ticketMint'),
  toRef(createForm, 'ticketPriceDisplay'),
  { fieldLabel: 'Ticket price' }
)

const slugRef = computed(() => tenantStore.slug ?? '')
const { conditions: apiConditions, price, refresh } = usePricePreview(slugRef, ref('raffles'), ref('monthly'))

const liveConditions = computed(() => upgradeConditionsOverride.value ?? conditions.value)

watch(apiConditions, (c) => {
  conditions.value = c
}, { immediate: true })

/** Current tier from subscription (paid tier) or price preview (e.g. before upgrade). */
const effectiveTierId = computed(() => {
  const fromSub = props.subscription?.selectedTierId
  if (fromSub) return fromSub
  const fromPrice = price.value?.selectedTierId
  return fromPrice ?? 'base'
})

/** Included slot count from tier: Base 1, Grow 3, Pro 10. */
const slotLimit = computed(() =>
  effectiveTierId.value === 'pro' ? 10 : effectiveTierId.value === 'grow' ? 3 : 1,
)

const activeRaffles = computed(() => raffles.value.filter((r) => !r.closedAt))

const chainDataByRaffle = ref<Record<string, RaffleChainData | null>>({})
const mintMetadataByTicketMint = ref<Record<string, { symbol: string; name: string }>>({})

/** Always show exactly slotLimit slots: filled or empty create buttons. */
const slotCards = computed((): SlotCard[] => {
  const active = activeRaffles.value
  const limit = slotLimit.value
  const chain = chainDataByRaffle.value
  const cards: SlotCard[] = []
  for (let i = 0; i < limit; i++) {
    const r = i < active.length ? active[i] : null
    cards.push({
      key: r ? r.rafflePubkey : `empty-${i}`,
      raffle: r,
      chainData: r ? (chain[r.rafflePubkey] ?? null) : null,
    })
  }
  return cards
})

watch(
  chainDataByRaffle,
  async (chain) => {
    const mints = new Set<string>()
    for (const data of Object.values(chain)) {
      if (data?.ticketMint) mints.add(data.ticketMint)
    }
    const map = { ...mintMetadataByTicketMint.value }
    let changed = false
    for (const mint of mints) {
      if (map[mint]) continue
      const meta = await fetchMetadata(mint)
      if (meta) {
        map[mint] = { symbol: meta.symbol, name: meta.name }
        changed = true
      }
    }
    if (changed) mintMetadataByTicketMint.value = { ...map }
  },
  { deep: true },
)

function openUpgradeModal() {
  upgradeConditionsOverride.value = null
  showUpgradeModal.value = true
}

function selectUpgradeTier(tier: 'grow' | 'pro') {
  upgradeConditionsOverride.value = { raffleSlotsUsed: tier === 'pro' ? 999 : 3 }
  showUpgradeModal.value = false
  nextTick(() => {
    document.getElementById('raffle-pricing-widget')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

const canCreateMore = computed(() => {
  const used = (conditions.value?.raffleSlotsUsed as number) ?? activeRaffles.value.length
  return used < slotLimit.value
})

const raffleSettings = computed(() => tenantStore.raffleSettings)
const whitelistFormValue = computed(() => {
  const rw = raffleSettings.value?.defaultWhitelist
  if (rw === 'use-default') return 'use-default'
  if (rw && typeof rw === 'object' && rw.account) return rw
  return null
})

const isDefaultWhitelistPublic = computed(() => whitelistFormValue.value === null)

const initialWhitelist = ref<string | null>(null)
const whitelistDirty = computed(() => {
  const current = whitelistFormValue.value
  const currStr = current === 'use-default' ? '__use_default__' : (current && typeof current === 'object' ? current.account : '')
  return currStr !== (initialWhitelist.value ?? '')
})

const savingWhitelist = ref(false)
const whitelistSaveSuccess = ref(false)
const whitelistSaveError = ref<string | null>(null)

function onWhitelistUpdate(value: { programId: string; account: string } | null | 'use-default') {
  const next = { ...(raffleSettings.value ?? {}), defaultWhitelist: value === 'use-default' ? 'use-default' : value }
  tenantStore.setRaffleSettings(next)
}

async function saveWhitelist() {
  savingWhitelist.value = true
  whitelistSaveError.value = null
  whitelistSaveSuccess.value = false
  try {
    const wl = whitelistFormValue.value
    const body: { defaultWhitelist?: { programId: string; account: string } | 'use-default' | null } = {
      defaultWhitelist: wl === 'use-default' ? 'use-default' : wl ?? null,
    }
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${slugRef.value}/raffle-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data.error as string) || `HTTP ${res.status}`)
    }
    const data = await res.json()
    tenantStore.setRaffleSettings(data.settings ?? {})
    initialWhitelist.value = whitelistFormValue.value === 'use-default' ? '__use_default__' : (whitelistFormValue.value && typeof whitelistFormValue.value === 'object' ? whitelistFormValue.value.account : null)
    whitelistSaveSuccess.value = true
  } catch (e) {
    whitelistSaveError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    savingWhitelist.value = false
  }
}

function openCreateModal(_slotIndex: number) {
  createForm.name = ''
  createForm.description = ''
  createForm.ticketMint = ''
  createForm.ticketPriceDisplay = ''
  createForm.maxTicketsDisplay = '100'
  if (isDefaultWhitelistPublic.value) {
    createForm.whitelist = null
  } else {
    createForm.whitelist = whitelistFormValue.value === 'use-default' ? 'use-default' : whitelistFormValue.value
  }
  createError.value = null
  showCreateModal.value = true
}

async function onCreateSubmit() {
  const name = createForm.name.trim()
  const ticketMint = createForm.ticketMint.trim()
  const maxTickets = Math.max(1, parseInt(createForm.maxTicketsDisplay, 10) || 100)
  if (!name || !ticketMint) {
    createError.value = 'Name and ticket mint are required'
    return
  }
  const dec = createTicketMeta.metadata.value?.decimals
  if (dec == null) {
    createError.value = 'Enter a valid ticket mint to load decimals first'
    return
  }
  const ticketPriceRaw = createTicketMeta.toRawAmount()
  if (!ticketPriceRaw || ticketPriceRaw === '0') {
    createError.value = 'Ticket price is required'
    return
  }

  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey) {
    createError.value = 'Wallet not connected'
    return
  }
  if (!connection.value) {
    createError.value = 'Solana RPC not configured'
    return
  }

  createSubmitting.value = true
  createError.value = null
  try {
    const paymentRes = await fetch(`${apiBase.value}${API_V1}/tenant/${slugRef.value}/billing/create-raffle-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
    if (!paymentRes.ok) {
      const data = (await paymentRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? `HTTP ${paymentRes.status}`)
    }
    const intent = (await paymentRes.json()) as {
      noPaymentRequired?: boolean
      paymentId?: string
      amountUsdc?: number
      memo?: string
      recipientAta?: string
    }

    const seed = Buffer.alloc(8)
    seed.writeBigUInt64LE(BigInt(Date.now()), 0)
    const rafflePda = deriveRafflePda(name, seed)

    const rw = createForm.whitelist
    const moduleDefault = rw === 'use-default' ? undefined : rw === null ? { programId: '', account: '' } : rw
    const effectiveWl = getEffectiveWhitelist(tenantStore.tenant?.defaultWhitelist ?? null, moduleDefault)
    const useWhitelist = Boolean(effectiveWl?.account?.trim())
    const whitelistAccount = useWhitelist && effectiveWl?.account ? effectiveWl.account : null

    const raffleTx = await buildInitializeRaffleTransaction({
      name,
      description: createForm.description.trim(),
      seed,
      ticketMint,
      ticketPrice: BigInt(ticketPriceRaw),
      ticketDecimals: dec,
      maxTickets,
      useWhitelist,
      whitelist: whitelistAccount,
      whitelistProgram: effectiveWl?.programId,
      connection: connection.value,
      wallet,
    })

    const { Transaction, PublicKey } = await import('@solana/web3.js')
    const skipPayment = intent.noPaymentRequired || !intent.paymentId || intent.amountUsdc == null || !intent.memo || !intent.recipientAta

    let combined: InstanceType<typeof Transaction>
    if (skipPayment) {
      combined = new Transaction()
      combined.feePayer = wallet.publicKey
      combined.add(...raffleTx.instructions)
    } else {
      const billingTx = buildBillingTransfer({
        payer: wallet.publicKey,
        amountUsdc: intent.amountUsdc,
        recipientAta: new PublicKey(intent.recipientAta),
        memo: intent.memo,
        connection: connection.value,
      })
      combined = new Transaction()
      combined.feePayer = wallet.publicKey
      combined.add(...raffleTx.instructions, ...billingTx.instructions)
    }

    const sig = await sendWithTxStatus(connection.value, combined, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')

    if (!skipPayment && !intent.noPaymentRequired && intent.paymentId) {
      const confirmRes = await fetch(`${apiBase.value}${API_V1}/tenant/${slugRef.value}/billing/confirm-raffle-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentId: intent.paymentId, txSignature: sig }),
      })
      if (!confirmRes.ok) {
        const data = (await confirmRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Payment confirmation failed')
      }
    }

    const postRes = await fetch(`${apiBase.value}${API_V1}/tenant/${slugRef.value}/raffles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rafflePubkey: rafflePda.toBase58() }),
    })
    if (!postRes.ok) {
      const data = (await postRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Failed to register raffle')
    }

    await fetchRaffles()
    showCreateModal.value = false
    createForm.name = ''
    createForm.description = ''
    createForm.ticketMint = ''
    createForm.ticketPriceDisplay = ''
    createForm.maxTicketsDisplay = '100'
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create'
  } finally {
    createSubmitting.value = false
  }
}

async function fetchRaffles() {
  if (!slugRef.value) return
  slotsLoading.value = true
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${slugRef.value}/raffles`, { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as { raffles: RaffleItem[] }
      raffles.value = data.raffles ?? []
      await fetchChainDataForRaffles()
    } else {
      raffles.value = []
    }
  } catch {
    raffles.value = []
  } finally {
    slotsLoading.value = false
  }
}

async function fetchChainDataForRaffles() {
  if (!connection.value) return
  const active = raffles.value.filter((r) => !r.closedAt)
  const next: Record<string, RaffleChainData | null> = {}
  for (const r of active) {
    try {
      const data = await fetchRaffleChainData(connection.value!, r.rafflePubkey)
      next[r.rafflePubkey] = data
    } catch {
      next[r.rafflePubkey] = null
    }
  }
  chainDataByRaffle.value = next
}

const {
  actionSubmitting,
  actionTxStatus,
  actionError,
  actionErrorRaffle,
  clearActionError,
  sendWithTxStatus,
  runRaffleAction,
} = useAdminRaffleActions({ connection, onSuccess: fetchChainDataForRaffles })

const prizeMintMeta = useMintMetadataForInput(
  toRef(addRewardForm, 'prizeMint'),
  toRef(addRewardForm, 'amountDisplay'),
  { fieldLabel: 'Amount' }
)

function openStartRaffleModal(slot: SlotCard) {
  selectedRaffleForStart.value = slot
  showStartRaffleModal.value = true
}

async function onConfirmStartRaffle() {
  const slot = selectedRaffleForStart.value
  if (!slot?.raffle || !connection.value) return
  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey) return
  showStartRaffleModal.value = false
  await runRaffleAction(slot.raffle.rafflePubkey, async () => {
    const tx = await buildEnableRaffleTransaction({ rafflePubkey: slot.raffle!.rafflePubkey, wallet })
    const sig = await sendWithTxStatus(connection.value!, tx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')
  }, 'Failed to start raffle')
  selectedRaffleForStart.value = null
}

function onCancelStartRaffle() {
  showStartRaffleModal.value = false
  selectedRaffleForStart.value = null
}

async function onPauseRaffle(slot: SlotCard) {
  if (!slot.raffle) return
  await runRaffleAction(slot.raffle.rafflePubkey, async () => {
    const wallet = getEscrowWalletFromConnector()!
    const tx = await buildDisableRaffleTransaction({ rafflePubkey: slot.raffle!.rafflePubkey, wallet })
    const sig = await sendWithTxStatus(connection.value!, tx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')
  }, 'Failed to pause raffle')
}

async function onResumeRaffle(slot: SlotCard) {
  if (!slot.raffle) return
  await runRaffleAction(slot.raffle.rafflePubkey, async () => {
    const wallet = getEscrowWalletFromConnector()!
    const tx = await buildEnableRaffleTransaction({ rafflePubkey: slot.raffle!.rafflePubkey, wallet })
    const sig = await sendWithTxStatus(connection.value!, tx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')
  }, 'Failed to resume raffle')
}

function openEditRaffleModal(slot: SlotCard) {
  selectedRaffleForEdit.value = slot
  editForm.name = slot.chainData?.name ?? ''
  editForm.description = slot.chainData?.description ?? ''
  editForm.url = slot.chainData?.url ?? ''
  showEditRaffleModal.value = true
}

async function onEditRaffleSubmit() {
  const slot = selectedRaffleForEdit.value
  if (!slot?.raffle || !connection.value) return
  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey) return
  showEditRaffleModal.value = false
  await runRaffleAction(slot.raffle.rafflePubkey, async () => {
    const tx = await buildEditRaffleTransaction({
      rafflePubkey: slot.raffle!.rafflePubkey,
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      url: editForm.url.trim(),
      wallet,
    })
    const sig = await sendWithTxStatus(connection.value!, tx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')
  }, 'Failed to edit raffle')
  selectedRaffleForEdit.value = null
}

async function onRevealWinner(slot: SlotCard) {
  if (!slot.raffle) return
  await runRaffleAction(slot.raffle.rafflePubkey, async () => {
    const wallet = getEscrowWalletFromConnector()!
    const tx = await buildRevealWinnersTransaction({ rafflePubkey: slot.raffle!.rafflePubkey, wallet })
    const sig = await sendWithTxStatus(connection.value!, tx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')
  }, 'Failed to reveal winner')
}

async function onDistributeReward(slot: SlotCard) {
  if (!slot.raffle || !slot.chainData?.winner || !connection.value) return
  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey) return
  const prizeMintPk = new PublicKey(slot.chainData.prizeMint)
  const winnerPk = new PublicKey(slot.chainData.winner)
  const winnerAta = getAssociatedTokenAddressSync(prizeMintPk, winnerPk, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
  await runRaffleAction(slot.raffle.rafflePubkey, async () => {
    const conn = connection.value!
    const claimTx = await buildClaimPrizeTransaction({
      rafflePubkey: slot.raffle!.rafflePubkey,
      prizeMint: slot.chainData!.prizeMint,
      winnerAta,
      connection: conn,
      wallet,
    })
    const tx = new Transaction()
    const winnerAtaInfo = await conn.getAccountInfo(winnerAta)
    if (!winnerAtaInfo) {
      tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, winnerAta, winnerPk, prizeMintPk, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID))
    }
    tx.add(...claimTx.instructions)
    const sig = await sendWithTxStatus(conn, tx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')
  }, 'Failed to distribute reward')
}

async function onClaimProceeds(slot: SlotCard) {
  if (!slot.raffle || !slot.chainData || !connection.value) return
  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey) return
  const ticketMintPk = new PublicKey(slot.chainData.ticketMint)
  const creatorAta = getAssociatedTokenAddressSync(ticketMintPk, wallet.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
  await runRaffleAction(slot.raffle.rafflePubkey, async () => {
    const conn = connection.value!
    const claimTx = await buildClaimTicketsTransaction({
      rafflePubkey: slot.raffle!.rafflePubkey,
      ticketMint: slot.chainData!.ticketMint,
      creatorAta,
      wallet,
    })
    const tx = new Transaction()
    const creatorAtaInfo = await conn.getAccountInfo(creatorAta)
    if (!creatorAtaInfo) {
      tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, creatorAta, wallet.publicKey, ticketMintPk, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID))
    }
    tx.add(...claimTx.instructions)
    const sig = await sendWithTxStatus(conn, tx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')
  }, 'Failed to claim proceeds')
}

async function onCloseRaffle(raffle: RaffleItem) {
  await runRaffleAction(
    raffle.rafflePubkey,
    async () => {
      const wallet = getEscrowWalletFromConnector()
      if (!wallet?.publicKey) throw new Error('Wallet not connected')
      const tx = await buildCloseRaffleTransaction({
        rafflePubkey: raffle.rafflePubkey,
        connection: connection.value!,
        wallet,
      })
      const sig = await sendWithTxStatus(connection.value!, tx, wallet, wallet.publicKey)
      if (!sig) throw new Error('Transaction failed')
      const res = await fetch(`${apiBase.value}${API_V1}/tenant/${slugRef.value}/raffles/${encodeURIComponent(raffle.rafflePubkey)}/close`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
    },
    'Failed to close raffle',
    fetchRaffles
  )
}

function openAddRewardModal(raffle: RaffleItem) {
  selectedRaffleForReward.value = raffle
  addRewardForm.prizeMint = ''
  addRewardForm.amountDisplay = ''
  addRewardForm.imageUrl = ''
  addRewardError.value = null
  showAddRewardModal.value = true
}

async function onAddRewardSubmit() {
  const raffle = selectedRaffleForReward.value
  if (!raffle || !connection.value) return

  const prizeMint = addRewardForm.prizeMint.trim()
  const amountStr = addRewardForm.amountDisplay.trim()
  if (!prizeMint) {
    addRewardError.value = 'Prize mint is required'
    return
  }
  const dec = prizeMintMeta.metadata.value?.decimals
  if (dec == null) {
    addRewardError.value = 'Enter a valid prize mint to load decimals first'
    return
  }
  const amountRaw = prizeMintMeta.toRawAmount()
  if (!amountRaw || amountRaw === '0') {
    addRewardError.value = 'Amount is required'
    return
  }

  const wallet = getEscrowWalletFromConnector()
  if (!wallet?.publicKey) {
    addRewardError.value = 'Wallet not connected'
    return
  }

  addRewardSubmitting.value = true
  addRewardError.value = null
  try {
    const raffleTx = await buildPrepareRaffleTransaction({
      rafflePubkey: raffle.rafflePubkey,
      prizeMint,
      amount: BigInt(amountRaw),
      imageUrl: addRewardForm.imageUrl.trim() || undefined,
      connection: connection.value,
      wallet,
    })

    const sig = await sendWithTxStatus(connection.value, raffleTx, wallet, wallet.publicKey)
    if (!sig) throw new Error('Transaction failed')

    showAddRewardModal.value = false
    selectedRaffleForReward.value = null
    await fetchRaffles()
  } catch (e) {
    addRewardError.value = e instanceof Error ? e.message : 'Failed to add reward'
  } finally {
    addRewardSubmitting.value = false
    actionTxStatus.value = null
  }
}

onMounted(async () => {
  const slug = slugRef.value
  if (!slug) return
  await fetchRaffles()
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${slug}/raffle-settings`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      const s = data.settings
      if (s?.defaultWhitelist === 'use-default') initialWhitelist.value = '__use_default__'
      else if (s?.defaultWhitelist?.account) initialWhitelist.value = s.defaultWhitelist.account
      else initialWhitelist.value = ''
    }
  } catch {
    /* ignore */
  }
})

const pricingRef = ref<InstanceType<typeof AdminPricingWidget> | null>(null)
function clearUpgradeConditions() {
  upgradeConditionsOverride.value = null
}

defineExpose({
  pricingRef,
  clearUpgradeConditions,
  refresh: () => {
    refresh()
    pricingRef.value?.refresh?.()
    fetchRaffles()
  },
})
</script>

<style scoped>
.admin__hint {
  margin: 0 0 var(--theme-space-md);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}
.admin__panel-actions {
  margin-top: var(--theme-space-md);
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
}
.admin__success {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-success);
}
.admin__error {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
}

.raffle-slots {
  margin-top: var(--theme-space-xl);
}
.raffle-slots__tx-status {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  margin: 0 0 var(--theme-space-md);
  font-size: var(--theme-font-sm);
  color: var(--theme-primary);
}
.raffle-slots__tx-spinner {
  animation: raffle-spin 1s linear infinite;
}
.raffle-slots__loading {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  color: var(--theme-text-muted);
  font-size: var(--theme-font-sm);
  padding: var(--theme-space-lg);
}
.raffle-slots__spinner {
  animation: raffle-spin 1s linear infinite;
}
@keyframes raffle-spin {
  to { transform: rotate(360deg); }
}
.raffle-slots__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--theme-space-lg);
}

.raffle-slot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: var(--theme-space-lg);
  border: 2px dashed var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-bg-card);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.raffle-slot-card--empty:hover:not(:disabled) {
  border-color: var(--theme-primary);
  background: var(--theme-bg-secondary, rgba(0, 0, 0, 0.02));
}
.raffle-slot-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.raffle-slot-card__plus {
  font-size: 3rem;
  color: var(--theme-text-muted);
  margin-bottom: var(--theme-space-sm);
}
.raffle-slot-card--empty:hover:not(:disabled) .raffle-slot-card__plus {
  color: var(--theme-primary);
}
.raffle-slot-card__label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.raffle-slot-card--upgrade {
  min-height: 120px;
  border-color: var(--theme-primary);
  border-style: dashed;
  background: transparent;
}
.raffle-slot-card--upgrade:hover {
  background: var(--theme-bg-secondary, rgba(0, 0, 0, 0.02));
  border-color: var(--theme-primary);
}
.raffle-slot-card__upgrade-icon {
  font-size: 1.5rem;
  color: var(--theme-primary);
  margin-bottom: var(--theme-space-xs);
}
.raffle-slot-card__upgrade-label {
  font-size: var(--theme-font-sm);
  font-weight: 600;
  color: var(--theme-primary);
}
.raffle-slot-card__upgrade-hint {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  margin-top: 2px;
}

.raffle-pricing-wrapper {
  scroll-margin-top: var(--theme-space-lg);
}

.raffle-upgrade-modal {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-lg);
}
.raffle-upgrade-modal__hint {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}
.raffle-upgrade-modal__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--theme-space-md);
}
.raffle-upgrade-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-lg);
  border: 2px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-bg-card);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.raffle-upgrade-option:hover {
  border-color: var(--theme-primary);
  background: var(--theme-bg-secondary, rgba(0, 0, 0, 0.02));
}
.raffle-upgrade-option--disabled,
.raffle-upgrade-option--disabled:hover {
  cursor: default;
  opacity: 0.7;
  border-color: var(--theme-border);
  background: var(--theme-bg-card);
}
.raffle-upgrade-option--current .raffle-upgrade-option__price {
  color: var(--theme-text-secondary);
}
.raffle-upgrade-option__badge {
  font-size: var(--theme-font-xs);
  font-weight: 600;
  color: var(--theme-text-muted);
  text-transform: uppercase;
}
.raffle-upgrade-option__name {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
}
.raffle-upgrade-option__slots {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}
.raffle-upgrade-option__price {
  font-size: var(--theme-font-md);
  font-weight: 600;
  color: var(--theme-primary);
}
.raffle-upgrade-modal__note {
  margin: 0;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.raffle-create-form {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
  min-width: 320px;
}
.raffle-create-form__hint {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.raffle-create-form__error {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
}
.raffle-create-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--theme-space-sm);
  margin-top: var(--theme-space-sm);
}

.raffle-add-reward-form {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
  overflow-wrap: break-word;
}
.raffle-add-reward-form :deep(input) {
  max-width: 100%;
  box-sizing: border-box;
}
.raffle-add-reward-form__hint {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}
.raffle-add-reward-form__error {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
}
.raffle-add-reward-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--theme-space-sm);
  margin-top: var(--theme-space-sm);
}

.raffle-start-modal {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
  min-width: 280px;
  overflow: hidden;
}
.raffle-start-modal__warning {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  line-height: 1.5;
}
.raffle-start-modal__name {
  margin: 0;
  font-weight: 600;
  font-size: var(--theme-font-base);
}
.raffle-start-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--theme-space-sm);
  margin-top: var(--theme-space-xs);
}

.raffle-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
  min-width: 320px;
}
.raffle-edit-form__hint {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}
.raffle-edit-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--theme-space-sm);
  margin-top: var(--theme-space-sm);
}
</style>
