<template>
  <PageSection title="Directory">
    <div v-if="loading" class="directory__loading">Loading...</div>
    <div v-else-if="error" class="directory__error">{{ error }}</div>
    <div v-else class="directory__grid">
      <Card
        v-for="t in tenants"
        :key="t.slug"
        class="directory__card"
      >
        <img
          v-if="t.branding?.logo"
          :src="t.branding.logo"
          :alt="t.name"
          class="directory__logo"
        />
        <h3>{{ t.name }}</h3>
        <p v-if="t.description" class="directory__desc">{{ t.description }}</p>
        <a :href="tenantUrl(t.slug)" target="_blank" rel="noopener">
          <Button variant="secondary">Visit</Button>
        </a>
      </Card>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
import { PageSection, Card, Button } from '@decentraguild/ui/components'
import type { TenantConfig } from '@decentraguild/core'

const config = useRuntimeConfig()
const tenants = ref<TenantConfig[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch(`${config.public.apiUrl}/api/v1/tenants`)
    if (!res.ok) throw new Error('Failed to fetch')
    const data = await res.json()
    tenants.value = data.tenants ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load tenants'
  } finally {
    loading.value = false
  }
})

function tenantUrl(slug: string) {
  return `https://${slug}.dguild.org`
}
</script>

<style scoped>
.directory__loading,
.directory__error {
  padding: var(--theme-space-xl);
  text-align: center;
  color: var(--theme-text-muted);
}

.directory__error {
  color: var(--theme-error);
}

.directory__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--theme-space-lg);
}

.directory__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.directory__logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: var(--theme-radius-md);
  margin-bottom: var(--theme-space-sm);
}

.directory__desc {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin: var(--theme-space-sm) 0;
  flex: 1;
}
</style>
