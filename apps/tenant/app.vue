<template>
  <div v-if="tenantStore.loading && !tenantStore.tenant" class="loading">Loading...</div>
  <div v-else-if="!tenantStore.tenant" class="no-tenant">
    No tenant. Use <code>?tenant=&lt;id&gt;</code> for local development (e.g. 0000000 or decentraguild). Set NUXT_PUBLIC_DEV_TENANT or add ?tenant= to the URL.
  </div>
  <NuxtLayout v-else>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()
const config = useRuntimeConfig()
const devTenantSlug = (config.public.devTenantSlug as string) ?? ''
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
