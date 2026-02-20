<template>
  <div class="market-tree">
    <div class="market-tree__home-row">
      <button
        type="button"
        class="market-tree__home"
        :class="{ 'market-tree__home--selected': selectedNodeId === null }"
        @click="selectNode(null)"
      >
        <Icon icon="mdi:home" class="market-tree__home-icon" />
        <span>Home</span>
      </button>
    </div>
    <div v-if="tree.length === 0" class="market-tree__empty">
      No assets in scope.
    </div>
    <ul v-else class="market-tree__list">
      <li
        v-for="node in tree"
        :key="node.id"
        class="market-tree__item"
      >
        <TreeNodeRow
          :node="node"
          :selected-id="selectedNodeId"
          @select="selectNode"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import TreeNodeRow from './TreeNodeRow.vue'
import { Icon } from '@iconify/vue'
import type { TreeNode } from '~/composables/useMarketplaceTree'

const props = defineProps<{
  tree: TreeNode[]
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  select: [id: string | null]
}>()

function selectNode(id: string | null) {
  emit('select', id)
}
</script>

<style scoped>
.market-tree {
  padding: var(--theme-space-xs) var(--theme-space-md);
  min-width: 0;
}

.market-tree__home-row {
  margin-bottom: var(--theme-space-sm);
  padding-bottom: var(--theme-space-sm);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.market-tree__home {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  width: 100%;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  background: none;
  border: none;
  border-radius: var(--theme-radius-md);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-primary);
  text-align: left;
  cursor: pointer;
}

.market-tree__home:hover {
  background: var(--theme-bg-secondary);
}

.market-tree__home--selected .market-tree__home-icon,
.market-tree__home--selected {
  color: var(--theme-primary);
  background: var(--theme-bg-secondary);
}

.market-tree__home-icon {
  font-size: 1rem;
  color: var(--theme-text-secondary);
  flex-shrink: 0;
}

.market-tree__empty {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  padding: var(--theme-space-md);
}

.market-tree__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.market-tree__item {
  margin: 0;
}
</style>
