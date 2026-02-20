<template>
  <NuxtLink
    v-if="to"
    :to="to"
    class="nav-link"
    :class="{ 'nav-link--active': isActive }"
    active-class="nav-link--active"
  >
    <Icon v-if="icon" :icon="icon" class="nav-link__icon" />
    <span class="nav-link__label"><slot /></span>
  </NuxtLink>
  <a
    v-else-if="href"
    :href="href"
    class="nav-link"
    :class="{ 'nav-link--active': isActive }"
  >
    <Icon v-if="icon" :icon="icon" class="nav-link__icon" />
    <span class="nav-link__label"><slot /></span>
  </a>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  /** Route path (string) or location object accepted by NuxtLink. */
  to?: string | { path?: string; query?: Record<string, string> }
  href?: string
  icon?: string
  isActive?: boolean
}>()
</script>

<style scoped>
.nav-link {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  padding: var(--theme-space-sm) var(--theme-space-md);
  color: var(--theme-text-secondary);
  text-decoration: none;
  border-radius: var(--theme-radius-md);
  transition: background-color 0.15s, color 0.15s;
}

.nav-link:hover {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-card);
}

.nav-link--active {
  color: var(--theme-primary);
  background-color: var(--theme-bg-card);
}

.nav-link__icon {
  font-size: var(--theme-font-lg);
}

.nav-link__label {
  font-size: var(--theme-font-sm);
}
</style>
