<template>
  <div :class="['status-banner', `status-banner--${variant}`]">
    <slot>
      <p v-if="message">{{ message }}</p>
    </slot>
    <slot v-if="$slots.hint" name="hint" />
    <slot v-if="$slots.action" name="action">
      <button
        v-if="retry"
        type="button"
        class="status-banner__retry"
        @click="$emit('retry')"
      >
        {{ retryLabel }}
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'error' | 'loading' | 'empty' | 'info'
    message?: string
    retry?: boolean
    retryLabel?: string
  }>(),
  {
    variant: 'info',
    retry: false,
    retryLabel: 'Retry',
  }
)

defineEmits<{ retry: [] }>()
</script>

<style scoped>
.status-banner {
  padding: var(--theme-space-lg);
  color: var(--theme-text-muted);
}

.status-banner--error {
  background: var(--theme-status-error, #fcc);
  color: var(--theme-text-primary, #111);
}

.status-banner--loading {
  color: var(--theme-text-secondary);
}

.status-banner--empty {
  text-align: center;
}

.status-banner--info {
  color: var(--theme-text-muted);
}

.status-banner__retry {
  margin-left: var(--theme-space-sm);
  padding: 2px 8px;
  font-size: var(--theme-font-xs);
  background: var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-primary);
  cursor: pointer;
}

.status-banner__retry:hover {
  border-color: var(--theme-primary);
}
</style>
