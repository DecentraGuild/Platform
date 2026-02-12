<template>
  <div v-if="tenantStore.loading" class="loading">Loading...</div>
  <div v-else-if="!tenantStore.tenant" class="no-tenant">
    No tenant. Use ?tenant=skull for local development.
  </div>
  <NuxtLayout v-else>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()
</script>

<style scoped>
.loading,
.no-tenant {
  padding: 2rem;
  text-align: center;
  color: var(--theme-text-muted);
}
</style>
