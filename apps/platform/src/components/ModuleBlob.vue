<template>
  <button
    type="button"
    class="module-blob"
    @click="emit('click')"
  >
    <span class="module-blob__icon-wrap">
      <Icon :icon="entry.icon" class="module-blob__icon" />
    </span>
    <span class="module-blob__name">{{ entry.name }}</span>
    <span v-if="entry.status === 'coming_soon'" class="module-blob__badge">Coming soon</span>
  </button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { ModuleCatalogEntry } from '@decentraguild/config'

defineProps<{
  entry: ModuleCatalogEntry
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<style scoped>
.module-blob {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--theme-space-sm);
  padding: var(--theme-space-lg);
  min-width: 120px;
  min-height: 120px;
  background: var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  cursor: pointer;
  color: var(--theme-text-primary);
  text-align: center;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
  scroll-snap-align: center;
}

.module-blob:hover {
  background: var(--theme-bg-secondary);
  border-color: var(--theme-border-light);
}

.module-blob__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg-secondary);
}

.module-blob__icon {
  font-size: 1.5rem;
  color: var(--theme-primary);
}

.module-blob__name {
  font-size: var(--theme-font-sm);
  font-weight: 600;
}

.module-blob__badge {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  background: var(--theme-bg-secondary);
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border-radius: var(--theme-radius-sm);
}
</style>
