<template>
  <nav v-if="prev || next" class="docs-chapter-nav" aria-label="Chapter navigation">
    <NuxtLink
      v-if="prev"
      :to="prev.path"
      class="docs-chapter-nav__btn docs-chapter-nav__btn--prev"
      :prefetch="false"
    >
      <Icon icon="lucide:chevron-left" class="docs-chapter-nav__icon" aria-hidden />
      <span class="docs-chapter-nav__label">{{ prev.label }}</span>
    </NuxtLink>
    <span v-else class="docs-chapter-nav__btn docs-chapter-nav__btn--empty" />
    <NuxtLink
      v-if="next"
      :to="next.path"
      class="docs-chapter-nav__btn docs-chapter-nav__btn--next"
      :prefetch="false"
    >
      <span class="docs-chapter-nav__label">{{ next.label }}</span>
      <Icon icon="lucide:chevron-right" class="docs-chapter-nav__icon" aria-hidden />
    </NuxtLink>
    <span v-else class="docs-chapter-nav__btn docs-chapter-nav__btn--empty" />
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { DocsNavItem } from '~/composables/useDocsNav'

defineProps<{
  prev: DocsNavItem | null
  next: DocsNavItem | null
}>()
</script>

<style scoped>
.docs-chapter-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--theme-space-md);
  margin-top: var(--theme-space-xl);
  padding-top: var(--theme-space-lg);
  border-top: 1px solid var(--theme-border);
}

.docs-chapter-nav__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--theme-space-xs);
  padding: var(--theme-space-sm) var(--theme-space-md);
  font-size: var(--theme-font-sm);
  color: var(--theme-primary);
  text-decoration: none;
  border-radius: 4px;
}

.docs-chapter-nav__btn:hover {
  background-color: var(--theme-bg-card);
}

.docs-chapter-nav__btn--prev {
  margin-right: auto;
}

.docs-chapter-nav__btn--next {
  margin-left: auto;
}

.docs-chapter-nav__btn--empty {
  flex: 1;
  min-width: 0;
}

.docs-chapter-nav__icon {
  width: 1.25em;
  height: 1.25em;
  flex-shrink: 0;
}
</style>
