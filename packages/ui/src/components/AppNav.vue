<template>
  <nav class="app-nav">
    <slot />
  </nav>
</template>

<script setup lang="ts"></script>

<style scoped>
.app-nav {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-md);
}
</style>
