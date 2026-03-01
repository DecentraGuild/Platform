<template>
  <div class="platform-layout">
    <header class="platform-header">
      <NuxtLink to="/" class="platform-header__brand">DecentraGuild</NuxtLink>
      <nav class="platform-header__nav">
        <NuxtLink to="/docs" :prefetch="false">Docs</NuxtLink>
        <NuxtLink to="/directory">Discover</NuxtLink>
        <NuxtLink to="/onboard">Create org</NuxtLink>
        <AuthWidget />
      </nav>
    </header>
    <main class="platform-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { AuthWidget } from '@decentraguild/auth'
</script>

<style scoped>
.platform-layout {
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-md) var(--theme-space-xl);
  background-color: var(--theme-bg-secondary);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.platform-header__brand {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
  text-decoration: none;
}

.platform-header__nav {
  display: flex;
  gap: var(--theme-space-lg);
}

.platform-header__nav a {
  color: var(--theme-text-secondary);
  text-decoration: none;
}

.platform-header__nav a:hover {
  color: var(--theme-primary);
}

.platform-main {
  padding: var(--theme-space-xl);
}
</style>
