<template>
  <div class="docs-page">
    <DocMarkdown v-if="doc" :html="doc.html" />
    <div v-else class="docs-not-found">
      <h2>Page not found</h2>
      <p>This documentation page does not exist.</p>
      <NuxtLink to="/docs">Back to docs</NuxtLink>
    </div>
    <DocsChapterNav v-if="doc" :prev="nav.prev" :next="nav.next" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const route = useRoute()
const slug = (route.params.slug as string) ?? ''
const { data: doc } = await useAsyncData(
  `docs-${route.path}`,
  () => useDocMarkdown(['modules', slug]),
)
const nav = useDocsNav(route.path)

useSeoMeta({
  title: doc.value?.meta.title ? `${doc.value.meta.title} | DecentraGuild Docs` : 'Docs | DecentraGuild',
  description: doc.value?.meta.description ?? 'DecentraGuild platform and module documentation',
})
</script>

<style scoped>
.docs-page {
  max-width: 720px;
}

.docs-not-found {
  padding: var(--theme-space-xl);
  color: var(--theme-text-secondary);
}

.docs-not-found h2 {
  color: var(--theme-text-primary);
  margin-bottom: var(--theme-space-sm);
}

.docs-not-found a {
  color: var(--theme-primary);
  text-decoration: none;
}

.docs-not-found a:hover {
  text-decoration: underline;
}
</style>
