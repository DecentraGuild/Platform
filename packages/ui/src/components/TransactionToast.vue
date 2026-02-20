<template>
  <div class="transaction-toast" :class="`transaction-toast--${status}`">
    <span class="transaction-toast__icon">
      <Icon v-if="status === 'pending'" icon="svg-spinners:ring-resize" class="transaction-toast__spinner" />
      <Icon v-else-if="status === 'success'" icon="mdi:check-circle" />
      <Icon v-else icon="mdi:alert-circle" />
    </span>
    <span class="transaction-toast__message">{{ message }}</span>
    <a
      v-if="signature"
      :href="explorerUrl"
      target="_blank"
      rel="noopener"
      class="transaction-toast__link"
    >
      View
    </a>
    <button
      v-if="dismissible"
      type="button"
      class="transaction-toast__dismiss"
      aria-label="Dismiss"
      @click="$emit('dismiss')"
    >
      <Icon icon="mdi:close" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  status: 'pending' | 'success' | 'error'
  message?: string
  signature?: string | null
  explorerUrl?: string
  dismissible?: boolean
}>()

defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
.transaction-toast {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  padding: var(--theme-space-sm) var(--theme-space-md);
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  box-shadow: var(--theme-shadow-card, 0 4px 12px rgba(0, 0, 0, 0.15));
  font-size: var(--theme-font-sm);
  color: var(--theme-text-primary);
}

.transaction-toast--success {
  border-color: var(--theme-status-success);
}

.transaction-toast--error {
  border-color: var(--theme-status-error);
}

.transaction-toast__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--theme-text-secondary);
}

.transaction-toast--success .transaction-toast__icon {
  color: var(--theme-status-success);
}

.transaction-toast--error .transaction-toast__icon {
  color: var(--theme-status-error);
}

.transaction-toast__spinner {
  font-size: 1.25rem;
}

.transaction-toast__message {
  flex: 1;
  min-width: 0;
}

.transaction-toast__link {
  flex-shrink: 0;
  color: var(--theme-primary);
  text-decoration: none;
}

.transaction-toast__link:hover {
  text-decoration: underline;
}

.transaction-toast__dismiss {
  flex-shrink: 0;
  padding: var(--theme-space-xs);
  background: none;
  border: none;
  color: var(--theme-text-muted);
  cursor: pointer;
  border-radius: var(--theme-radius-sm);
}

.transaction-toast__dismiss:hover {
  color: var(--theme-text-primary);
  background: var(--theme-bg-secondary);
}
</style>
