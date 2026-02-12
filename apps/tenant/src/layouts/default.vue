<template>
  <AppShell>
    <div v-if="tenantStore.error" class="tenant-error">
      {{ tenantStore.error }}
      <span class="tenant-error__hint">Ensure the API is running and the tenant slug exists.</span>
    </div>
    <template #header>
      <AppHeader
        :logo="themeStore.branding.logo"
        :name="themeStore.branding.name ?? tenant?.name"
      >
        <template #actions>
          <AuthWidget />
        </template>
        <template #nav>
          <NavLink to="/" icon="mdi:home">Home</NavLink>
          <NavLink
            v-for="mod in navModules"
            :key="mod.id"
            :to="mod.path"
            :icon="mod.icon"
          >
            {{ mod.label }}
          </NavLink>
        </template>
      </AppHeader>
    </template>
    <template #nav>
      <AppNav>
        <NavLink to="/" icon="mdi:home">Home</NavLink>
        <NavLink
          v-for="mod in navModules"
          :key="mod.id"
          :to="mod.path"
          :icon="mod.icon"
        >
          {{ mod.label }}
        </NavLink>
      </AppNav>
    </template>
    <slot />
  </AppShell>
</template>

<script setup lang="ts">
import {
  AppShell,
  AppHeader,
  AppNav,
  NavLink,
} from '@decentraguild/ui/components'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_ROUTES, IMPLEMENTED_MODULES } from '~/config/modules'

const tenantStore = useTenantStore()
const themeStore = useThemeStore()

const tenant = computed(() => tenantStore.tenant)

const auth = useAuth()
const isAdmin = computed(() => {
  const w = auth.wallet.value
  const admins = tenant.value?.admins ?? []
  return !!(w && admins.includes(w))
})

const navModules = computed(() => {
  if (!tenant.value?.modules) return []
  return tenant.value.modules
    .filter((m) => m.enabled && IMPLEMENTED_MODULES.has(m.id))
    .filter((m) => m.id !== 'admin' || isAdmin.value)
    .map((m) => {
      const route = MODULE_ROUTES[m.id]
      const icons: Record<string, string> = {
        admin: 'mdi:cog',
        marketplace: 'mdi:store',
        raffles: 'mdi:ticket',
        whitelist: 'mdi:format-list-checks',
        minting: 'mdi:brush',
      }
      return {
        id: m.id,
        path: route?.path ?? '#',
        label: route?.label ?? m.id,
        icon: icons[m.id],
      }
    })
})
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
</style>
