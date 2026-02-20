<template>
  <div class="tree-node-row" :class="{ 'tree-node-row--selected': isSelected }">
    <div class="tree-node-row__btn" :class="`tree-node-row__btn--${node.kind}`">
      <button
        v-if="hasChildren"
        type="button"
        class="tree-node-row__chevron-btn"
        aria-label="Toggle"
        @click.stop="expanded = !expanded"
      >
        <Icon :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
      </button>
      <span v-else class="tree-node-row__spacer" />
      <button
        type="button"
        class="tree-node-row__content"
        @click="$emit('select', node.id)"
      >
        <Icon :icon="kindIcon" class="tree-node-row__icon" />
        <span class="tree-node-row__label">{{ node.label }}</span>
      </button>
    </div>
    <template v-if="hasChildren && expanded">
      <ul class="tree-node-row__children">
        <li v-for="child in node.children" :key="child.id" class="tree-node-row__child">
          <TreeNodeRow
            :node="child"
            :selected-id="selectedId"
            @select="$emit('select', $event)"
          />
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { TreeNode } from '~/composables/useMarketplaceTree'

const props = defineProps<{
  node: TreeNode
  selectedId: string | null
}>()

defineEmits<{
  select: [id: string | null]
}>()

const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0)
const isSelected = computed(() => props.selectedId === props.node.id)
const expanded = ref(true)

const kindIcon = computed(() => {
  switch (props.node.kind) {
    case 'type':
      return 'mdi:folder'
    case 'group':
      return 'mdi:folder-outline'
    case 'asset':
      return 'mdi:file-document-outline'
    default:
      return 'mdi:file'
  }
})
</script>

<style scoped>
.tree-node-row {
  margin: 0;
}

.tree-node-row__btn {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  width: 100%;
}

.tree-node-row__chevron-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: none;
  border: none;
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.tree-node-row__chevron-btn:hover {
  color: var(--theme-text-primary);
}

.tree-node-row__content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-xs) var(--theme-space-sm);
  background: none;
  border: none;
  border-radius: var(--theme-radius-md);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-primary);
  text-align: left;
  cursor: pointer;
}

.tree-node-row__content:hover {
  background: var(--theme-bg-secondary);
}

.tree-node-row--selected .tree-node-row__content {
  background: var(--theme-bg-secondary);
  color: var(--theme-primary);
}

.tree-node-row__chevron-btn,
.tree-node-row__spacer {
  width: 1rem;
  flex-shrink: 0;
}

.tree-node-row__icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: var(--theme-text-secondary);
}

.tree-node-row__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-node-row__children {
  list-style: none;
  margin: 0 0 0 var(--theme-space-md);
  padding: 0;
}

.tree-node-row__child {
  margin: 0;
}
</style>
