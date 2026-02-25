<template>
  <Teleport to="body">
    <div v-if="modelValue" class="admin-collection-modal" @click.self="$emit('update:modelValue', false)">
      <div class="admin-collection-modal__panel">
        <div class="admin-collection-modal__header">
          <h3 class="admin-collection-modal__title">{{ collection.name || 'Collection' }}</h3>
          <button type="button" class="admin-collection-modal__close" aria-label="Close" @click="$emit('update:modelValue', false)">
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div class="admin-collection-modal__body">
          <section v-if="collection" class="admin-collection-modal__stored">
            <h4 class="admin-collection-modal__section-title">Stored in config</h4>
            <div class="admin-collection-modal__stored-grid">
              <div v-if="collection.image" class="admin-collection-modal__thumb-wrap">
                <img :src="collection.image" :alt="collection.name ?? collection.mint" class="admin-collection-modal__thumb" />
              </div>
              <div class="admin-collection-modal__stored-fields">
                <p class="admin-collection-modal__field">
                  <span class="admin-collection-modal__label">Mint</span>
                  <code class="admin-collection-modal__mint">{{ collection.mint }}</code>
                  <a :href="explorerLinks.tokenUrl(collection.mint)" target="_blank" rel="noopener" class="admin-collection-modal__link">Solscan</a>
                </p>
                <p v-if="collection.name" class="admin-collection-modal__field">
                  <span class="admin-collection-modal__label">Name</span>
                  <span>{{ collection.name }}</span>
                </p>
                <p v-if="collection.sellerFeeBasisPoints != null" class="admin-collection-modal__field">
                  <span class="admin-collection-modal__label">Seller fee</span>
                  <span>{{ collection.sellerFeeBasisPoints }} bps</span>
                </p>
                <p v-if="collection.groupPath?.length" class="admin-collection-modal__field">
                  <span class="admin-collection-modal__label">Group path</span>
                  <span>{{ collection.groupPath.join(' / ') }}</span>
                </p>
              </div>
            </div>
          </section>

          <section v-if="collection && (collection.traitTypes?.length ?? 0) > 0" class="admin-collection-modal__traits">
            <h4 class="admin-collection-modal__section-title">Unique traits in collection</h4>
            <div class="admin-collection-modal__trait-pills">
              <span
                v-for="t in collection.traitTypes"
                :key="t"
                class="admin-collection-modal__trait-pill"
              >{{ t }}</span>
            </div>
          </section>

          <section class="admin-collection-modal__nfts">
          <h4 class="admin-collection-modal__section-title">Member NFTs</h4>
          <div v-if="loading" class="admin-collection-modal__loading">
            <Icon icon="mdi:loading" class="admin-collection-modal__spinner" />
            <span>Loading NFTs...</span>
          </div>
          <div v-else-if="assets.length === 0" class="admin-collection-modal__empty">
            <p>No NFTs in scope. Run scope expand or add the collection and save.</p>
          </div>
          <div v-else class="admin-collection-modal__grid">
            <div
              v-for="nft in assets"
              :key="nft.mint"
              class="admin-collection-modal__card"
            >
              <div class="admin-collection-modal__card-media">
                <img v-if="nft.metadata?.image" :src="nft.metadata.image" :alt="nft.metadata.name ?? nft.mint" />
                <div v-else class="admin-collection-modal__card-placeholder">
                  <Icon icon="mdi:image-off" />
                </div>
              </div>
              <div class="admin-collection-modal__card-info">
                <p class="admin-collection-modal__card-name">{{ nft.metadata?.name ?? truncateAddress(nft.mint) }}</p>
                <p class="admin-collection-modal__card-mint" :title="nft.mint">{{ truncateAddress(nft.mint, 6, 6) }}</p>
                <div v-if="(nft.metadata?.traits?.length ?? 0) > 0" class="admin-collection-modal__card-traits">
                  <span
                    v-for="(attr, idx) in (nft.metadata?.traits ?? []).slice(0, 2)"
                    :key="idx"
                    class="admin-collection-modal__trait-tag"
                  >
                    {{ attr.trait_type }}: {{ attr.value }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { truncateAddress } from '@decentraguild/display'
import { useMarketplaceAssets } from '~/composables/useMarketplaceAssets'
import { useExplorerLinks } from '~/composables/useExplorerLinks'

const props = defineProps<{
  modelValue: boolean
  slug: string
  collection: {
    mint: string
    name?: string
    image?: string
    sellerFeeBasisPoints?: number
    groupPath?: string[]
    traitTypes?: string[]
  } | null
}>()

defineEmits<{ 'update:modelValue': [v: boolean] }>()

const explorerLinks = useExplorerLinks()
const collectionMintRef = ref<string | null>(null)
watch(
  () => props.collection?.mint ?? null,
  (v) => { collectionMintRef.value = v },
  { immediate: true }
)

const slugRef = computed(() => props.slug)

const { assets, loading } = useMarketplaceAssets({
  slug: slugRef,
  collection: collectionMintRef,
  limit: 500,
})
</script>

<style scoped>
.admin-collection-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.admin-collection-modal__panel {
  background: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  max-width: min(95vw, 56rem);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-collection-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-md) var(--theme-space-lg);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.admin-collection-modal__title {
  margin: 0;
  font-size: var(--theme-font-lg);
  color: var(--theme-text-primary);
}

.admin-collection-modal__close {
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.admin-collection-modal__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.admin-collection-modal__stored,
.admin-collection-modal__traits,
.admin-collection-modal__nfts {
  padding: var(--theme-space-md) var(--theme-space-lg);
  flex-shrink: 0;
}

.admin-collection-modal__nfts {
  padding-bottom: var(--theme-space-lg);
}

.admin-collection-modal__section-title {
  margin: 0 0 var(--theme-space-sm);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-collection-modal__stored-grid {
  display: flex;
  gap: var(--theme-space-md);
  margin-bottom: 0;
}

.admin-collection-modal__traits {
  border-top: var(--theme-border-thin) solid var(--theme-border);
}

.admin-collection-modal__trait-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.admin-collection-modal__trait-pill {
  font-size: var(--theme-font-xs);
  padding: 2px 8px;
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-secondary);
}

.admin-collection-modal__thumb-wrap {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: var(--theme-radius-md);
  overflow: hidden;
  border: var(--theme-border-thin) solid var(--theme-border);
}

.admin-collection-modal__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-collection-modal__stored-fields {
  flex: 1;
  min-width: 0;
}

.admin-collection-modal__field {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-sm);
}

.admin-collection-modal__label {
  display: inline-block;
  min-width: 5rem;
  color: var(--theme-text-muted);
}

.admin-collection-modal__mint {
  font-family: ui-monospace, monospace;
  font-size: var(--theme-font-xs);
  word-break: break-all;
}

.admin-collection-modal__link {
  margin-left: var(--theme-space-sm);
  color: var(--theme-primary);
}

.admin-collection-modal__loading,
.admin-collection-modal__empty {
  padding: var(--theme-space-lg);
  text-align: center;
  color: var(--theme-text-muted);
  font-size: var(--theme-font-sm);
}

.admin-collection-modal__spinner {
  display: inline-block;
  animation: admin-collection-spin 0.8s linear infinite;
  margin-right: var(--theme-space-sm);
}

@keyframes admin-collection-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.admin-collection-modal__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--theme-space-md);
}

.admin-collection-modal__card {
  background: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  overflow: hidden;
}

.admin-collection-modal__card-media {
  aspect-ratio: 1;
  background: var(--theme-bg-primary);
}

.admin-collection-modal__card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-collection-modal__card-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-text-muted);
  font-size: 2rem;
}

.admin-collection-modal__card-info {
  padding: var(--theme-space-sm);
}

.admin-collection-modal__card-name {
  margin: 0 0 2px;
  font-size: var(--theme-font-xs);
  font-weight: 600;
  color: var(--theme-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-collection-modal__card-mint {
  margin: 0 0 var(--theme-space-xs);
  font-size: 10px;
  font-family: ui-monospace, monospace;
  color: var(--theme-text-muted);
}

.admin-collection-modal__card-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.admin-collection-modal__trait-tag {
  font-size: 9px;
  padding: 1px 4px;
  background: var(--theme-bg-primary);
  border-radius: 2px;
  color: var(--theme-text-secondary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
