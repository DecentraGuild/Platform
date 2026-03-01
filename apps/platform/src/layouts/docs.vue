<template>
  <div class="platform-layout docs-layout">
    <header class="platform-header">
      <NuxtLink to="/" class="platform-header__brand">DecentraGuild</NuxtLink>
      <nav class="platform-header__nav">
        <NuxtLink to="/docs" :prefetch="false">Docs</NuxtLink>
        <NuxtLink to="/directory">Discover</NuxtLink>
        <NuxtLink to="/onboard">Create org</NuxtLink>
        <AuthWidget />
      </nav>
    </header>
    <div class="docs-body">
      <aside class="docs-sidebar">
        <DocsSidebar />
      </aside>
      <main class="docs-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AuthWidget } from '@decentraguild/auth'
</script>

<style scoped>
.platform-layout.docs-layout {
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
  border-bottom: 1px solid var(--theme-border);
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

.docs-body {
  display: flex;
  flex: 1;
  min-height: calc(100vh - 56px);
}

.docs-sidebar {
  width: 260px;
  flex-shrink: 0;
  padding: var(--theme-space-xl);
  border-right: 1px solid var(--theme-border);
  background-color: var(--theme-bg-secondary);
}

.docs-main {
  flex: 1;
  padding: var(--theme-space-2xl);
  overflow-x: hidden;
  max-width: 800px;
}
</style>
