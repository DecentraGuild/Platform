<template>
  <div class="token-amount-input">
    <label v-if="label" :for="id" class="token-amount-input__label">{{ label }}</label>
    <div class="token-amount-input__wrap">
      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="token-amount-input__field"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <div v-if="showQuickAmounts && !disabled" class="token-amount-input__quick">
        <button type="button" class="token-amount-input__quick-btn" @click="$emit('setPercent', 0.25)">25%</button>
        <button type="button" class="token-amount-input__quick-btn" @click="$emit('setPercent', 0.5)">50%</button>
        <button type="button" class="token-amount-input__quick-btn" @click="$emit('setPercent', 0.75)">75%</button>
        <button type="button" class="token-amount-input__quick-btn" @click="$emit('setPercent', 1)">Max</button>
      </div>
    </div>
    <p v-if="hint" class="token-amount-input__hint">{{ hint }}</p>
    <p v-if="error" class="token-amount-input__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    type?: string
    placeholder?: string
    disabled?: boolean
    error?: string
    hint?: string
    showQuickAmounts?: boolean
  }>(),
  { type: 'text', disabled: false, showQuickAmounts: false }
)

defineEmits<{
  'update:modelValue': [value: string]
  setPercent: [pct: number]
}>()

const id = computed(() => `token-amount-${Math.random().toString(36).slice(2)}`)
</script>

<style scoped>
.token-amount-input {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
}

.token-amount-input__label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.token-amount-input__wrap {
  display: flex;
  align-items: stretch;
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background-color: var(--theme-bg-primary);
  transition: border-color 0.15s;
}

.token-amount-input__wrap:focus-within {
  border-color: var(--theme-primary);
}

.token-amount-input__field {
  flex: 1;
  min-width: 0;
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-base);
  color: var(--theme-text-primary);
  background: none;
  border: none;
  outline: none;
}

.token-amount-input__field::placeholder {
  color: var(--theme-text-muted);
}

.token-amount-input__field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-amount-input__quick {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  border-left: var(--theme-border-thin) solid var(--theme-border);
}

.token-amount-input__quick-btn {
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  font-weight: 500;
  color: var(--theme-text-secondary);
  background: none;
  border: none;
  border-left: var(--theme-border-thin) solid var(--theme-border);
  cursor: pointer;
}

.token-amount-input__quick-btn:first-child {
  border-left: none;
}

.token-amount-input__quick-btn:hover {
  color: var(--theme-primary);
  background: var(--theme-bg-secondary);
}

.token-amount-input__hint,
.token-amount-input__error {
  margin: 0;
  font-size: var(--theme-font-sm);
}

.token-amount-input__hint {
  color: var(--theme-text-muted);
}

.token-amount-input__error {
  color: var(--theme-error);
}
</style>
