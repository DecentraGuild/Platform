<template>
  <div class="select-wrap">
    <label v-if="label" :for="id" class="select-wrap__label">{{ label }}</label>
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      class="select-wrap__field"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <template v-if="optionGroups?.length">
        <option value="">{{ placeholder }}</option>
        <optgroup
          v-for="(grp, gi) in optionGroups"
          :key="gi"
          :label="grp.groupLabel"
        >
          <option
            v-for="opt in grp.options"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </optgroup>
      </template>
      <template v-else>
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </template>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    options?: { value: string; label: string }[]
    optionGroups?: { groupLabel: string; options: { value: string; label: string }[] }[]
    placeholder?: string
    disabled?: boolean
  }>(),
  { options: () => [], placeholder: '', optionGroups: undefined }
)

defineEmits<{
  'update:modelValue': [value: string]
}>()

const id = computed(() => `select-${Math.random().toString(36).slice(2)}`)
</script>

<style scoped>
.select-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
}

.select-wrap__label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.select-wrap__field {
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-base);
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-primary);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  outline: none;
  cursor: pointer;
}

.select-wrap__field:focus {
  border-color: var(--theme-primary);
}

.select-wrap__field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.select-wrap__field optgroup {
  font-weight: 600;
  color: var(--theme-text-secondary);
  padding: var(--theme-space-xs) 0;
}
</style>
