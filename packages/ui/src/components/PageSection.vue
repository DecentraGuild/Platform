<template>
  <section class="page-section">
    <div v-if="title || $slots.header" class="page-section__header">
      <h2 v-if="title" class="page-section__title">{{ title }}</h2>
      <slot name="header" />
    </div>
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

.page-section__header {
  display: flex;
  align-items: center;
  gap: var(--theme-space-lg);
  flex-wrap: wrap;
  margin-bottom: var(--theme-space-md);
}

.page-section__title {
  font-size: var(--theme-font-xl);
  font-weight: 600;
  color: var(--theme-text-primary);
  margin: 0;
}
</style>
