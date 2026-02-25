<template>
  <Card v-if="showStaging || showDeactivating" class="admin-deploy-card">
    <p v-if="showStaging" class="admin-deploy-card__hint">
      {{ stagingHint }}
    </p>
    <p v-else-if="showDeactivating" class="admin-deploy-card__hint">
      {{ deactivatingHint }}
    </p>
    <Button
      v-if="showStaging"
      variant="primary"
      :disabled="deploying"
      @click="$emit('deploy')"
    >
      <Icon v-if="deploying" icon="mdi:loading" class="admin-deploy-card__spinner" />
      Deploy
    </Button>
    <Button
      v-else-if="showDeactivating"
      variant="secondary"
      :disabled="saving"
      @click="$emit('reactivate')"
    >
      Reactivate
    </Button>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ModuleState } from '@decentraguild/core'
import { Card, Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    moduleState: ModuleState
    stagingHint?: string
    deactivatingHint?: string
    deploying?: boolean
    saving?: boolean
  }>(),
  {
    stagingHint: 'Configure below, then deploy to make it active for members.',
    deactivatingHint: 'Module is deactivating.',
    deploying: false,
    saving: false,
  }
)

defineEmits<{ deploy: [] ; reactivate: [] }>()

const showStaging = computed(() => props.moduleState === 'staging')
const showDeactivating = computed(() => props.moduleState === 'deactivating')
</script>

<style scoped>
.admin-deploy-card {
  margin-bottom: var(--theme-space-md);
}

.admin-deploy-card__hint {
  margin-bottom: var(--theme-space-md);
  color: var(--theme-text-secondary);
  font-size: var(--theme-font-sm);
}

.admin-deploy-card__spinner {
  vertical-align: middle;
  margin-right: var(--theme-space-xs);
}
</style>
