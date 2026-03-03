<template>
  <AppShell
    :mobile-nav-open="mobileNavOpen"
    @update:mobile-nav-open="mobileNavOpen = $event"
  >
    <ClientOnly>
      <div v-if="tenantStore.error" class="tenant-error">
        {{ tenantStore.error }}
        <span class="tenant-error__hint">Ensure the API is running and the tenant slug exists.</span>
      </div>
      <template #fallback />
    </ClientOnly>
    <template v-if="!showTenantGatedMessage" #header>
      <AppHeader
        :logo="headerLogo"
        :name="headerName"
      >
        <template #leading>
          <button
            type="button"
            class="layout-nav-toggle"
            aria-label="Open menu"
            @click="mobileNavOpen = true"
          >
            <Icon icon="mdi:menu" />
          </button>
        </template>
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
    <template v-if="!showTenantGatedMessage" #nav>
      <div class="layout-nav">
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
        <a
          :href="discoverUrl"
          target="_blank"
          rel="noopener"
          class="layout-nav__discover"
        >
          <Icon icon="mdi:compass-outline" class="layout-nav__discover-icon" />
          <span>Discover</span>
        </a>
      </div>
    </template>
    <div v-if="showTenantGatedMessage" class="tenant-gated">
      <p class="tenant-gated__message">This community is gated. You need to be on the whitelist to access it.</p>
    </div>
    <slot v-else />
    <ClientOnly>
      <TransactionToastContainer />
    </ClientOnly>
  </AppShell>
</template>

<script setup lang="ts">
import { AuthWidget, useAuth } from '@decentraguild/auth'
import { Icon } from '@iconify/vue'
import {
  AppShell,
  AppHeader,
  AppNav,
  NavLink,
} from '@decentraguild/ui/components'
import TransactionToastContainer from '~/components/TransactionToastContainer.vue'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { isModuleVisibleToMembers, getModuleState, getEffectiveWhitelist } from '@decentraguild/core'
import { MODULE_NAV, IMPLEMENTED_MODULES, NAV_ORDER, getModuleSubnavForPath } from '~/config/modules'
import { useWhitelistListed } from '~/composables/useWhitelistListed'
import { useWalletOnList } from '~/composables/useWalletOnList'

const config = useRuntimeConfig()
const discoverUrl = `${(config.public.platformBaseUrl as string).replace(/\/$/, '')}/directory`

const route = useRoute()
const tenantStore = useTenantStore()
const themeStore = useThemeStore()
const mobileNavOpen = ref(false)

watch(() => route.path, () => {
  mobileNavOpen.value = false
})

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

// Avoid hydration mismatch: isAdmin is only known after client mount (wallet from /me).
// Server and first client paint both use false; after mount we update.
const navReady = ref(false)
onMounted(() => { navReady.value = true })
const isAdminForNav = computed(() => navReady.value && isAdmin.value)

const slug = computed(() => tenantStore.slug ?? null)
const wallet = computed(() => auth.wallet.value ?? null)
const { listed: whitelistListed } = useWhitelistListed(slug, wallet)

const tenantDefaultListAddress = computed(() => {
  const acc = tenant.value?.defaultWhitelist?.account
  return (acc && acc.trim()) || null
})
const { listed: isOnTenantDefaultList } = useWalletOnList(slug, tenantDefaultListAddress, wallet)

const marketplaceSettings = computed(() => tenantStore.marketplaceSettings)
const effectiveMarketplaceWhitelist = computed(() =>
  getEffectiveWhitelist(tenant.value?.defaultWhitelist ?? null, marketplaceSettings.value?.whitelist)
)
const marketplaceListAddress = computed(() => effectiveMarketplaceWhitelist.value?.account?.trim() || null)
const { listed: isOnMarketplaceList } = useWalletOnList(slug, marketplaceListAddress, wallet)

const raffleSettings = computed(() => tenantStore.raffleSettings)
const raffleModuleWhitelistForEffective = computed(() => {
  const rw = raffleSettings.value?.defaultWhitelist
  if (rw === 'use-default' || rw === undefined) return undefined
  if (rw === null) return { programId: '', account: '' }
  return rw
})
const effectiveRaffleWhitelist = computed(() =>
  getEffectiveWhitelist(tenant.value?.defaultWhitelist ?? null, raffleModuleWhitelistForEffective.value)
)
const raffleListAddress = computed(() => effectiveRaffleWhitelist.value?.account?.trim() || null)
const { listed: isOnRaffleList } = useWalletOnList(slug, raffleListAddress, wallet)

const hasAnyPublicModule = computed(() => {
  if (tenant.value?.modules?.marketplace && isModuleVisibleToMembers(getModuleState(tenant.value.modules.marketplace)) && effectiveMarketplaceWhitelist.value === null) return true
  if (tenant.value?.modules?.raffles && isModuleVisibleToMembers(getModuleState(tenant.value.modules.raffles)) && effectiveRaffleWhitelist.value === null) return true
  return false
})

const showTenantGatedMessage = computed(() => {
  if (!tenantDefaultListAddress.value) return false
  if (isOnTenantDefaultList.value === true) return false
  if (hasAnyPublicModule.value) return false
  return true
})

const navModules = computed(() => {
  const mods = tenant.value?.modules ?? {}
  const entries = Object.entries(mods)
    .filter(([id, e]) => isModuleVisibleToMembers(getModuleState(e)) && IMPLEMENTED_MODULES.has(id))
    .filter(([id]) => id !== 'admin' || isAdminForNav.value)
    .filter(([id]) => {
      if (id === 'whitelist') return whitelistListed.value === true
      if (id === 'marketplace' && effectiveMarketplaceWhitelist.value && !isOnMarketplaceList.value) return false
      if (id === 'raffles' && effectiveRaffleWhitelist.value && !isOnRaffleList.value) return false
      return true
    })
    .map(([id]) => {
      const entry = MODULE_NAV[id]
      return {
        id,
        path: entry?.path ?? '#',
        label: entry?.label ?? id,
        icon: entry?.icon ?? 'mdi:circle',
      }
    })
  entries.sort((a, b) => {
    const ai = NAV_ORDER.indexOf(a.id)
    const bi = NAV_ORDER.indexOf(b.id)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
  return entries
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
  flex-wrap: nowrap;
}

.layout-subnav__tab {
  flex-shrink: 0;
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

.layout-nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.layout-nav-toggle:hover {
  color: var(--theme-text-primary);
  background: var(--theme-bg-card);
}

@media (max-width: var(--theme-breakpoint-md)) {
  .layout-nav-toggle {
    display: flex;
  }
}

.layout-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.layout-nav__discover {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  margin-top: auto;
  padding: var(--theme-space-sm) var(--theme-space-md);
  color: var(--theme-text-secondary);
  text-decoration: none;
  border-radius: var(--theme-radius-md);
  font-size: var(--theme-font-sm);
  transition: background-color 0.15s, color 0.15s;
}

.layout-nav__discover:hover {
  color: var(--theme-primary);
  background-color: var(--theme-bg-card);
}

.layout-nav__discover-icon {
  font-size: 1.25rem;
}

.tenant-gated {
  padding: var(--theme-space-xl);
  text-align: center;
}

.tenant-gated__message {
  margin: 0;
  font-size: var(--theme-font-md);
  color: var(--theme-text-secondary);
}
</style>
