<template>
  <div class="text-input">
    <label v-if="label" :for="id" class="text-input__label">{{ label }}</label>
    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="text-input__field"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="text-input__error">{{ error }}</p>
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
  }>(),
  { type: 'text', disabled: false }
)

defineEmits<{
  'update:modelValue': [value: string]
}>()

const id = computed(() => `input-${Math.random().toString(36).slice(2)}`)
</script>

<style scoped>
.text-input {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
}

.text-input__label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.text-input__field {
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-base);
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  outline: none;
  transition: border-color 0.15s;
}

.text-input__field:focus {
  border-color: var(--theme-primary);
}

.text-input__field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-input__error {
  font-size: var(--theme-font-sm);
  color: var(--theme-error);
}
</style>
