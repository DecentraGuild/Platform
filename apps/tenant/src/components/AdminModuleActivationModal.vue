<template>
  <Modal
    :model-value="modelValue"
    :title="moduleEntry?.name ?? 'Activate module'"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="activation-modal">
      <p class="activation-modal__staging">
        This module enters a <strong>staging phase</strong>. Configure it exactly how you want, review pricing, and pay when ready. Deploy only when you are satisfied.
      </p>

      <div v-if="instructions" class="activation-modal__content">
        <p class="activation-modal__intro">{{ instructions.intro }}</p>
        <ul v-if="instructions.steps?.length" class="activation-modal__steps">
          <li v-for="(step, i) in instructions.steps" :key="i">{{ step }}</li>
        </ul>
        <p v-if="instructions.note" class="activation-modal__note">{{ instructions.note }}</p>
      </div>

      <div v-else-if="moduleEntry" class="activation-modal__content">
        <p class="activation-modal__intro">{{ moduleEntry.longDescription }}</p>
      </div>

      <div class="activation-modal__actions">
        <Button variant="primary" @click="$emit('update:modelValue', false)">
          Got it
        </Button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { Modal, Button } from '@decentraguild/ui/components'
import { getModuleCatalogEntry } from '@decentraguild/config'

const props = defineProps<{
  modelValue: boolean
  moduleId: string | null
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const moduleEntry = computed(() =>
  props.moduleId ? getModuleCatalogEntry(props.moduleId) : null
)

const instructions = computed(() => moduleEntry.value?.activationInstructions)
</script>

<style scoped>
.activation-modal {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-lg);
}

.activation-modal__staging {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  line-height: 1.5;
}

.activation-modal__content {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-sm);
}

.activation-modal__intro {
  margin: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-primary);
  line-height: 1.5;
}

.activation-modal__steps {
  margin: 0;
  padding-left: var(--theme-space-lg);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  line-height: 1.6;
}

.activation-modal__steps li {
  margin-bottom: var(--theme-space-xs);
}

.activation-modal__note {
  margin: 0;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  font-style: italic;
}

.activation-modal__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--theme-space-sm);
}
</style>
