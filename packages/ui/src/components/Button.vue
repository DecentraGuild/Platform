<template>
  <component
    :is="tag"
    :type="tag === 'button' ? (submit ? 'submit' : 'button') : undefined"
    :disabled="disabled"
    class="btn"
    :class="variantClass"
    v-bind="$attrs"
  >
    <Icon v-if="icon && !iconRight" :icon="icon" class="btn__icon" />
    <span v-if="$slots.default" class="btn__label"><slot /></span>
    <Icon v-if="icon && iconRight" :icon="icon" class="btn__icon btn__icon--right" />
  </component>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    tag?: 'button' | 'a'
    submit?: boolean
    disabled?: boolean
    icon?: string
    iconRight?: boolean
  }>(),
  { variant: 'primary', tag: 'button', submit: false, disabled: false, iconRight: false }
)

const variantClass = computed(() => `btn--${props.variant}`)
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--theme-space-sm);
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  font-weight: 500;
  border-radius: var(--theme-radius-md);
  border: var(--theme-border-thin) solid transparent;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background-color: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}

.btn--primary:hover:not(:disabled) {
  background-color: var(--theme-primary-hover);
  border-color: var(--theme-primary-hover);
}

.btn--secondary {
  background-color: transparent;
  color: var(--theme-primary);
  border-color: var(--theme-primary);
}

.btn--secondary:hover:not(:disabled) {
  background-color: var(--theme-primary);
  color: white;
}

.btn--ghost {
  background-color: transparent;
  color: var(--theme-text-secondary);
}

.btn--ghost:hover:not(:disabled) {
  background-color: var(--theme-bg-card);
  color: var(--theme-text-primary);
}

.btn__icon {
  font-size: var(--theme-font-lg);
}

.btn__icon--right {
  order: 1;
}
</style>
