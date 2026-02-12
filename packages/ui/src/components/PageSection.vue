<template>
  <section class="page-section">
    <h2 v-if="title" class="page-section__title">{{ title }}</h2>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<style scoped>
.page-section {
  padding: var(--theme-space-xl) 0;
}

.page-section__title {
  font-size: var(--theme-font-xl);
  font-weight: 600;
  color: var(--theme-text-primary);
  margin-bottom: var(--theme-space-md);
}
</style>
