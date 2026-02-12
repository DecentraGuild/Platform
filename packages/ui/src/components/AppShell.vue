<template>
  <div class="app-shell">
    <header v-if="$slots.header" class="app-shell__header">
      <slot name="header" />
    </header>
    <div class="app-shell__body">
      <nav v-if="$slots.nav" class="app-shell__nav">
        <slot name="nav" />
      </nav>
      <main class="app-shell__main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.app-shell__header {
  background-color: var(--theme-bg-secondary);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.app-shell__body {
  display: flex;
}

.app-shell__nav {
  flex-shrink: 0;
  background-color: var(--theme-bg-secondary);
  border-right: var(--theme-border-thin) solid var(--theme-border);
}

.app-shell__main {
  flex: 1;
  padding: var(--theme-space-xl);
}
</style>
