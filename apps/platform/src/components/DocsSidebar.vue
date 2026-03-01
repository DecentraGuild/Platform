<template>
  <nav class="docs-sidebar__nav">
    <NuxtLink to="/docs" class="docs-sidebar__link" :class="{ 'docs-sidebar__link--active': isActive('/docs') }" :prefetch="false">
      Overview
    </NuxtLink>
    <div class="docs-sidebar__section">
      <span class="docs-sidebar__section-title">General</span>
      <NuxtLink
        v-for="item in generalItems"
        :key="item.path"
        :to="item.path"
        class="docs-sidebar__link"
        :class="{ 'docs-sidebar__link--active': isActive(item.path) }"
        :prefetch="false"
      >
        {{ item.label }}
      </NuxtLink>
    </div>
    <div class="docs-sidebar__section">
      <span class="docs-sidebar__section-title">Admin</span>
      <NuxtLink
        v-for="item in adminItems"
        :key="item.path"
        :to="item.path"
        class="docs-sidebar__link"
        :class="{ 'docs-sidebar__link--active': isActive(item.path) }"
        :prefetch="false"
      >
        {{ item.label }}
      </NuxtLink>
    </div>
    <div class="docs-sidebar__section">
      <span class="docs-sidebar__section-title">Market</span>
      <NuxtLink
        v-for="item in marketItems"
        :key="item.path"
        :to="item.path"
        class="docs-sidebar__link"
        :class="{ 'docs-sidebar__link--active': isActive(item.path) }"
        :prefetch="false"
      >
        {{ item.label }}
      </NuxtLink>
    </div>
    <div class="docs-sidebar__section">
      <span class="docs-sidebar__section-title">Discord</span>
      <NuxtLink
        v-for="item in discordItems"
        :key="item.path"
        :to="item.path"
        class="docs-sidebar__link"
        :class="{ 'docs-sidebar__link--active': isActive(item.path) }"
        :prefetch="false"
      >
        {{ item.label }}
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const generalItems = [
  { path: '/docs/general/getting-started', label: 'Getting started' },
  { path: '/docs/general/creating-a-dguild', label: 'Creating a dGuild' },
  { path: '/docs/general/directory', label: 'Directory' },
  { path: '/docs/general/billing-overview', label: 'Billing' },
]

const adminItems = [
  { path: '/docs/modules/admin', label: 'General' },
  { path: '/docs/modules/admin/domains-and-slugs', label: 'Domains and slugs' },
]

const marketItems = [
  { path: '/docs/modules/marketplace', label: 'General' },
  { path: '/docs/modules/marketplace/how-it-works', label: 'How it works' },
  { path: '/docs/modules/marketplace/collections-currencies', label: 'Collections and currencies' },
  { path: '/docs/modules/marketplace/fees-tiers', label: 'Fees and tiers' },
]

const discordItems = [
  { path: '/docs/modules/discord', label: 'General' },
  { path: '/docs/modules/discord/verify-flow', label: 'Verify flow' },
  { path: '/docs/modules/discord/setup', label: 'Setup and role rules' },
]

function isActive(path: string): boolean {
  if (path === '/docs') return route.path === '/docs'
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.docs-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-sm);
}

.docs-sidebar__section {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
  margin-top: var(--theme-space-md);
}

.docs-sidebar__section-title {
  font-size: var(--theme-font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-text-muted);
  margin-bottom: var(--theme-space-xs);
}

.docs-sidebar__link {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  text-decoration: none;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border-radius: 4px;
}

.docs-sidebar__link:hover {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-card);
}

.docs-sidebar__link--active {
  color: var(--theme-primary);
  font-weight: 500;
}
</style>
