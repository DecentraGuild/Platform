<template>
  <label class="toggle">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="toggle__input"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="toggle__track" />
    <span v-if="$slots.default || label" class="toggle__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: boolean
  label?: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-sm);
  cursor: pointer;
}

.toggle__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle__track {
  width: 2.5rem;
  height: 1.25rem;
  background-color: var(--theme-bg-secondary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-full);
  position: relative;
  transition: background-color 0.15s, border-color 0.15s;
}

.toggle__track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(1.25rem - 4px);
  height: calc(1.25rem - 4px);
  background-color: var(--theme-text-muted);
  border-radius: var(--theme-radius-full);
  transition: transform 0.15s, background-color 0.15s;
}

.toggle__input:checked + .toggle__track {
  background-color: var(--theme-primary);
  border-color: var(--theme-primary);
}

.toggle__input:checked + .toggle__track::after {
  transform: translateX(1.25rem);
  background-color: white;
}

.toggle__input:disabled + .toggle__track {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle__label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.toggle__input:disabled ~ .toggle__label {
  cursor: not-allowed;
}
</style>
