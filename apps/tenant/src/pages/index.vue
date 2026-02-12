<template>
  <PageSection>
    <h1>{{ tenant?.name ?? 'dGuild' }}</h1>
    <p v-if="tenant?.description" class="home__desc">{{ tenant.description }}</p>
    <div v-if="hasAdmin" class="home__cta">
      <NuxtLink to="/admin">
        <Button variant="primary">Admin</Button>
      </NuxtLink>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
import { PageSection, Button } from '@decentraguild/ui/components'
import { useTenantStore } from '~/stores/tenant'
import { IMPLEMENTED_MODULES } from '~/config/modules'

const tenantStore = useTenantStore()
const tenant = computed(() => tenantStore.tenant)

const hasAdmin = computed(
  () => tenant.value?.modules?.some((m) => m.id === 'admin' && m.enabled && IMPLEMENTED_MODULES.has('admin')) ?? false
)
</script>

<style scoped>
.home__desc {
  color: var(--theme-text-secondary);
  margin: var(--theme-space-md) 0;
}

.home__cta {
  margin-top: var(--theme-space-lg);
}
</style>
