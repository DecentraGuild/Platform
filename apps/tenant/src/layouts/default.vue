<template>
  <AppShell>
    <ClientOnly>
      <div v-if="tenantStore.error" class="tenant-error">
        {{ tenantStore.error }}
        <span class="tenant-error__hint">Ensure the API is running and the tenant slug exists.</span>
      </div>
      <template #fallback />
    </ClientOnly>
    <template #header>
      <AppHeader
        :logo="headerLogo"
        :name="headerName"
      >
        <template #nav>
          <nav v-if="subnavTabs.length" class="layout-subnav">
            <NuxtLink
              v-for="tab in subnavTabs"
              :key="tab.id"
              :to="tab.path ? linkTo(tab.path) : linkToWithTab(route.path, tab.id)"
              class="layout-subnav__tab"
              :class="{ 'layout-subnav__tab--active': isSubnavTabActive(tab) }"
            >
              {{ tab.label }}
            </NuxtLink>
          </nav>
        </template>
        <template #actions>
          <AuthWidget />
        </template>
      </AppHeader>
    </template>
    <template #nav>
      <AppNav>
        <NavLink :to="linkTo('/')" icon="mdi:home">Home</NavLink>
        <NavLink
          v-for="mod in navModules"
          :key="mod.id"
          :to="linkTo(mod.path)"
          :icon="mod.icon"
        >
          {{ mod.label }}
        </NavLink>
      </AppNav>
    </template>
    <slot />
    <ClientOnly>
      <TransactionToastContainer />
    </ClientOnly>
  </AppShell>
</template>

<script setup lang="ts">
import { AuthWidget, useAuth } from '@decentraguild/auth'
import {
  AppShell,
  AppHeader,
  AppNav,
  NavLink,
} from '@decentraguild/ui/components'
import TransactionToastContainer from '~/components/TransactionToastContainer.vue'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_NAV, IMPLEMENTED_MODULES, getModuleSubnavForPath } from '~/config/modules'

const route = useRoute()
const tenantStore = useTenantStore()
const themeStore = useThemeStore()

const tenant = computed(() => tenantStore.tenant)

// Header branding only after client mount so SSR and first client paint match (avoids hydration mismatch: server span vs client img).
const headerLogo = ref('')
const headerName = ref('dGuild')
const tenantName = computed(() => (themeStore.branding.name ?? tenant.value?.name) || 'dGuild')
const isMarketPath = computed(() => route.path === '/market' || route.path.startsWith('/market/'))
function updateHeaderBranding() {
  headerLogo.value = themeStore.branding.logo ?? ''
  headerName.value = isMarketPath.value
    ? `Marketplace [${tenantName.value}]`
    : tenantName.value
}
onMounted(updateHeaderBranding)
watch(
  () => [themeStore.branding.logo, themeStore.branding.name, tenant.value?.name, route.path],
  updateHeaderBranding
)

const auth = useAuth()
const isAdmin = computed(() => {
  const w = auth.wallet.value
  const admins = tenant.value?.admins ?? []
  return !!(w && admins.includes(w))
})

const navModules = computed(() => {
  const mods = tenant.value?.modules ?? {}
  return Object.entries(mods)
    .filter(([id, e]) => e.active && IMPLEMENTED_MODULES.has(id))
    .filter(([id]) => id !== 'admin' || isAdmin.value)
    .map(([id]) => {
      const entry = MODULE_NAV[id]
      return {
        id,
        path: entry?.path ?? '#',
        label: entry?.label ?? id,
        icon: entry?.icon ?? 'mdi:circle',
      }
    })
})

const subnavTabs = computed(() => getModuleSubnavForPath(route.path, tenant.value) ?? [])

function linkTo(path: string) {
  const slug = tenantStore.slug
  return slug ? { path, query: { tenant: slug } } : path
}

function linkToWithTab(path: string, tabId: string) {
  const slug = tenantStore.slug
  const query: Record<string, string> = { tab: tabId }
  if (slug) query.tenant = slug
  return { path, query }
}

function isSubnavTabActive(tab: { id: string; path?: string }): boolean {
  if (tab.path) {
    const p = route.path
    return p === tab.path || (tab.path !== '/' && p.startsWith(tab.path + '/'))
  }
  const tabQuery = route.query.tab as string | undefined
  if (tab.id === 'browse' && (tabQuery === undefined || tabQuery === 'browse')) {
    return route.path === '/market' || route.path.startsWith('/market/')
  }
  return tabQuery === tab.id
}
</script>

<style scoped>
.tenant-error {
  padding: var(--theme-space-md);
  background: var(--theme-status-error, #fcc);
  color: var(--theme-text-primary, #111);
  text-align: center;
  font-size: var(--theme-font-sm);
}
.tenant-error__hint {
  display: block;
  margin-top: var(--theme-space-sm);
  opacity: 0.9;
}

.layout-subnav {
  display: flex;
  gap: var(--theme-space-xs);
  align-items: center;
}

.layout-subnav__tab {
  padding: var(--theme-space-sm) var(--theme-space-md);
  color: var(--theme-text-secondary);
  text-decoration: none;
  border-radius: var(--theme-radius-md);
  font-size: var(--theme-font-sm);
}

.layout-subnav__tab:hover {
  color: var(--theme-text-primary);
  background: var(--theme-bg-card);
}

.layout-subnav__tab--active {
  color: var(--theme-primary);
  background: var(--theme-bg-card);
}
</style>
