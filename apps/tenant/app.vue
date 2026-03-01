<template>
  <div v-if="tenantStore.loading && !tenantStore.tenant" class="loading">Loading...</div>
  <div v-else-if="!tenantStore.tenant" class="no-tenant">
    No tenant. Use ?tenant=<slug> for local development (default: {{ devTenantSlug }}).
  </div>
  <NuxtLayout v-else>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()
const config = useRuntimeConfig()
const devTenantSlug = (config.public.devTenantSlug as string) || 'skull'
</script>

<style scoped>
.loading,
.no-tenant {
  padding: 2rem;
  text-align: center;
  color: var(--theme-text-muted);
  background: var(--theme-bg-primary);
  min-height: 100vh;
}
</style>
