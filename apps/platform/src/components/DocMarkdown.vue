<template>
  <article class="docs-prose" v-html="html" />
</template>

<script setup lang="ts">
defineProps<{
  html: string
}>()
</script>

<style scoped>
.docs-prose :deep(h1) {
  font-size: var(--theme-font-2xl);
  font-weight: 600;
  margin-bottom: var(--theme-space-lg);
  color: var(--theme-text-primary);
}

.docs-prose :deep(h2) {
  font-size: var(--theme-font-xl);
  font-weight: 600;
  margin-top: var(--theme-space-2xl);
  margin-bottom: var(--theme-space-md);
  color: var(--theme-text-primary);
  padding-top: var(--theme-space-lg);
  border-top: 1px solid var(--theme-border);
}

.docs-prose :deep(h2:first-of-type) {
  margin-top: var(--theme-space-lg);
  padding-top: 0;
  border-top: none;
}

.docs-prose :deep(h3) {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  margin-top: var(--theme-space-xl);
  margin-bottom: var(--theme-space-sm);
  color: var(--theme-text-primary);
}

.docs-prose :deep(p) {
  margin-bottom: var(--theme-space-md);
  line-height: 1.6;
  color: var(--theme-text-secondary);
}

.docs-prose :deep(ul),
.docs-prose :deep(ol) {
  margin-bottom: var(--theme-space-md);
  padding-left: var(--theme-space-xl);
  color: var(--theme-text-secondary);
}

.docs-prose :deep(li) {
  margin-bottom: var(--theme-space-xs);
}

.docs-prose :deep(a) {
  color: var(--theme-primary);
  text-decoration: none;
}

.docs-prose :deep(a:hover) {
  text-decoration: underline;
}

.docs-prose :deep(code) {
  font-size: 0.9em;
  padding: 0.1em 0.4em;
  background-color: var(--theme-bg-card);
  border-radius: 4px;
  border: 1px solid var(--theme-border);
}

.docs-prose :deep(pre) {
  padding: var(--theme-space-md);
  background-color: var(--theme-bg-card);
  border-radius: 8px;
  border: 1px solid var(--theme-border);
  overflow-x: auto;
  margin-bottom: var(--theme-space-md);
}

.docs-prose :deep(pre code) {
  padding: 0;
  background: none;
  border: none;
}
</style>
