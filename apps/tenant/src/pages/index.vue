<template>
  <PageSection>
    <div class="home">
      <div class="home__brand">
        <img
          v-if="brandLogo"
          :src="brandLogo"
          :alt="displayName"
          class="home__logo"
        >
        <span v-else class="home__logo-placeholder">{{ displayName.charAt(0) }}</span>
        <h1 class="home__name">{{ displayName }}</h1>
      </div>
      <p v-if="showDescription" class="home__desc">{{ tenant?.description }}</p>
      <div v-if="showAdminCta" class="home__cta">
        <NuxtLink :to="adminLink">
          <Button variant="primary">Admin</Button>
        </NuxtLink>
      </div>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
import { PageSection, Button } from '@decentraguild/ui/components'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { IMPLEMENTED_MODULES } from '~/config/modules'

const themeStore = useThemeStore()
const tenantStore = useTenantStore()
const tenant = computed(() => tenantStore.tenant)

const displayName = ref('dGuild')
const brandLogo = ref('')
const showDescription = ref(false)
const showAdminCta = ref(false)

function applyTenant() {
  const t = tenantStore.tenant
  displayName.value = (themeStore.branding.name ?? t?.name) || 'dGuild'
  brandLogo.value = themeStore.branding.logo ?? t?.branding?.logo ?? ''
  showDescription.value = Boolean(t?.description)
  showAdminCta.value =
    (t?.modules?.admin?.active && IMPLEMENTED_MODULES.has('admin')) ?? false
}
onMounted(applyTenant)
watch([tenant, () => themeStore.branding], applyTenant)

const adminLink = computed(() =>
  tenantStore.slug
    ? { path: '/admin', query: { tenant: tenantStore.slug, tab: 'general' } }
    : { path: '/admin', query: { tab: 'general' } }
)
</script>

<style scoped>
.home {
  max-width: 28rem;
}

.home__brand {
  display: flex;
  align-items: center;
  gap: var(--theme-space-md);
  margin-bottom: var(--theme-space-md);
}

.home__logo,
.home__logo-placeholder {
  width: 3rem;
  height: 3rem;
  border-radius: var(--theme-radius-md);
  object-fit: cover;
}

.home__logo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-bg-secondary);
  color: var(--theme-text-secondary);
  font-size: var(--theme-font-xl);
  font-weight: 600;
}

.home__name {
  font-size: var(--theme-font-2xl);
  font-weight: 600;
  margin: 0;
}

.home__desc {
  color: var(--theme-text-secondary);
  margin: 0 0 var(--theme-space-lg);
  font-size: var(--theme-font-sm);
}

.home__cta {
  margin-top: var(--theme-space-lg);
}
</style>
