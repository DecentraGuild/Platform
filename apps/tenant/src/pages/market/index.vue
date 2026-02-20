<template>
  <PageSection>
    <ClientOnly>
      <div v-if="!marketplaceActive" class="market-shell-inactive">
        <p>Marketplace is not enabled for this dGuild.</p>
      </div>
      <div v-else class="market-shell" :class="{ 'market-shell--no-tree': activeTab === 'open-trades' }">
        <aside v-if="activeTab !== 'open-trades'" class="market-shell__tree">
          <MarketTree
            :tree="tree"
            :selected-node-id="selectedNodeId"
            @select="selectNode"
          />
        </aside>
        <main class="market-shell__main">
          <div class="market-shell__content">
            <MarketBrowseView
              v-show="activeTab === 'browse'"
              :child-nodes="childNodesForSelection"
              :descendant-asset-nodes="descendantAssetNodes"
              :selected-node="selectedNode"
              :selected-detail-mint="selectedDetailMint"
              :breadcrumb-path="selectedNode?.path ?? []"
              :select-node="selectNode"
              :set-selected-detail-mint="setSelectedDetailMint"
              @open-create-trade="openCreateTradeModal"
            />
            <MarketOpenTradesView
              v-show="activeTab === 'open-trades'"
              :tab-active="activeTab === 'open-trades'"
              @open-create-trade="openCreateTradeModalFromMyTrades"
            />
          </div>
        </main>
      </div>
      <EscrowDetailModal
        :model-value="escrowModalOpen"
        :escrow-id="escrowId"
        @update:model-value="onEscrowModalClose"
      />
      <Teleport to="body">
        <div v-if="offerRequestChoiceOpen" class="create-trade-modal-overlay" @click.self="offerRequestChoiceOpen = false">
          <div class="create-trade-modal create-trade-modal--choice" @click.stop>
            <div class="create-trade-modal__header">
              <h3>Create trade with this asset</h3>
              <button type="button" class="create-trade-modal__close" aria-label="Close" @click="offerRequestChoiceOpen = false">
                <Icon icon="mdi:close" />
              </button>
            </div>
            <p class="create-trade-modal__choice-hint">Start as offer (you give this) or request (you want this)?</p>
            <div class="create-trade-modal__choice-actions">
              <button type="button" class="create-trade-modal__choice-btn" @click="startCreateAsOffer">
                Offer (from wallet)
              </button>
              <button type="button" class="create-trade-modal__choice-btn" @click="startCreateAsRequest">
                Request (what you want)
              </button>
            </div>
          </div>
        </div>
        <div v-if="createTradeModalOpen" class="create-trade-modal-overlay" @click.self="createTradeModalOpen = false">
          <div class="create-trade-modal" @click.stop>
            <div class="create-trade-modal__header">
              <h3>Create trade</h3>
              <button type="button" class="create-trade-modal__close" aria-label="Close" @click="createTradeModalOpen = false">
                <Icon icon="mdi:close" />
              </button>
            </div>
            <CreateTradeForm
              :initial-offer-mint="createInitialOfferMint"
              :initial-offer-type="createInitialOfferType"
              :initial-request-mint="createInitialRequestMint"
              @success="onCreateTradeSuccess"
            />
          </div>
        </div>
      </Teleport>
      <template #fallback>
        <div class="marketplace__loading">Loading...</div>
      </template>
    </ClientOnly>
  </PageSection>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { PageSection } from '@decentraguild/ui/components'
import { useTenantStore } from '~/stores/tenant'
import { useMarketplaceScope } from '~/composables/useMarketplaceScope'
import { useMarketplaceTree } from '~/composables/useMarketplaceTree'
import { Icon } from '@iconify/vue'

const MarketTree = defineAsyncComponent(() => import('~/modules/marketplace/components/MarketTree.vue'))
const MarketBrowseView = defineAsyncComponent(() => import('~/modules/marketplace/components/MarketBrowseView.vue'))
const MarketOpenTradesView = defineAsyncComponent(() => import('~/modules/marketplace/components/MarketOpenTradesView.vue'))
const EscrowDetailModal = defineAsyncComponent(() => import('~/modules/marketplace/components/EscrowDetailModal.vue'))
const CreateTradeForm = defineAsyncComponent(() => import('~/modules/marketplace/components/CreateTradeForm.vue'))

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const tenantStore = useTenantStore()
const { slug, marketplaceSettings } = storeToRefs(tenantStore)

const tenant = computed(() => tenantStore.tenant)
const marketplaceActive = computed(() => tenant.value?.modules?.marketplace?.active ?? false)
const activeTab = computed(() => (route.query.tab === 'open-trades' ? 'open-trades' : 'browse'))

const { entries } = useMarketplaceScope(slug)
const {
  tree,
  selectedNodeId,
  selectedNode,
  childNodesForSelection,
  descendantAssetNodes,
  selectedDetailMint,
  selectNode,
  setSelectedDetailMint,
} = useMarketplaceTree(entries, marketplaceSettings)

watch(
  selectedNode,
  (node) => {
    if (node?.kind === 'asset' && node.mint && node.mint !== node.collectionMint) {
      setSelectedDetailMint(node.mint)
    }
  },
  { immediate: true }
)

const createTradeModalOpen = ref(false)
const offerRequestChoiceOpen = ref(false)
const createInitialOfferMint = ref<string | null>(null)
const createInitialRequestMint = ref<string | null>(null)
const createInitialOfferType = ref<string | null>(null)

const selectedAssetType = computed(() => {
  const node = selectedNode.value
  if (!node?.mint) return null
  if (node.collectionMint && node.mint === node.collectionMint) return 'NFT_COLLECTION'
  const settings = marketplaceSettings.value
  if (!settings) return null
  if (settings.currencyMints?.some((c) => c.mint === node.mint)) return 'CURRENCY'
  if (settings.splAssetMints?.some((s) => s.mint === node.mint)) return 'SPL_ASSET'
  return null
})

function openCreateTradeModal(skipOfferRequestChoice = false) {
  if (!skipOfferRequestChoice && selectedDetailMint.value) {
    offerRequestChoiceOpen.value = true
  } else {
    createInitialOfferMint.value = null
    createInitialRequestMint.value = null
    createInitialOfferType.value = null
    createTradeModalOpen.value = true
  }
}

function openCreateTradeModalFromMyTrades() {
  openCreateTradeModal(true)
}

function startCreateAsOffer() {
  createInitialOfferMint.value = selectedDetailMint.value
  createInitialRequestMint.value = null
  createInitialOfferType.value = selectedAssetType.value
  offerRequestChoiceOpen.value = false
  createTradeModalOpen.value = true
}

function startCreateAsRequest() {
  createInitialOfferMint.value = null
  createInitialRequestMint.value = selectedDetailMint.value
  createInitialOfferType.value = null
  offerRequestChoiceOpen.value = false
  createTradeModalOpen.value = true
}

function onCreateTradeSuccess() {
  createTradeModalOpen.value = false
}

const escrowId = computed(() => (route.query.escrow as string) ?? null)
const escrowModalOpen = computed(() => Boolean(escrowId.value))

function onEscrowModalClose() {
  const q = { ...route.query }
  delete q.escrow
  router.replace({ path: '/market', query: q })
}

</script>

<style scoped>
.market-shell-inactive {
  padding: var(--theme-space-lg);
  color: var(--theme-text-muted);
}

.market-shell {
  display: grid;
  grid-template-columns: 15rem 1fr;
  gap: var(--theme-space-lg);
  min-height: 24rem;
}

.market-shell--no-tree {
  grid-template-columns: 1fr;
}

@media (max-width: 768px) {
  .market-shell {
    grid-template-columns: 1fr;
  }
}

.market-shell__tree {
  border-right: var(--theme-border-thin) solid var(--theme-border);
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 768px) {
  .market-shell__tree {
    border-right: none;
    border-bottom: var(--theme-border-thin) solid var(--theme-border);
  }
}

.market-shell__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.create-trade-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.create-trade-modal {
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  max-width: min(90vw, 36rem);
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--theme-space-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.create-trade-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--theme-space-md);
}

.create-trade-modal__header h3 {
  margin: 0;
  font-size: var(--theme-font-lg);
}

.create-trade-modal__close {
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
}

.create-trade-modal__choice-hint {
  margin: 0 0 var(--theme-space-md);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.create-trade-modal__choice-actions {
  display: flex;
  gap: var(--theme-space-md);
  flex-wrap: wrap;
}

.create-trade-modal__choice-btn {
  flex: 1;
  min-width: 10rem;
  padding: var(--theme-space-md) var(--theme-space-lg);
  font-size: var(--theme-font-sm);
  font-weight: 500;
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-primary);
  cursor: pointer;
}

.create-trade-modal__choice-btn:hover {
  border-color: var(--theme-primary);
  background: var(--theme-bg-primary);
}

.market-shell__content {
  flex: 1;
  min-height: 0;
}

.marketplace__loading {
  padding: var(--theme-space-lg);
  color: var(--theme-text-secondary);
}
</style>
