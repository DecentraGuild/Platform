<template>
  <PageSection>
    <h1>Build Your Own</h1>
    <p class="home__sub">
      Communities build their own hub. Create a dGuild with your branding, treasury, and modules.
    </p>
    <div class="home__cta">
      <NuxtLink to="/directory">
        <Button variant="primary">Discover dGuilds</Button>
      </NuxtLink>
      <Button variant="secondary" disabled>Create org</Button>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
import { PageSection, Button } from '@decentraguild/ui/components'
</script>

<style scoped>
.home__sub {
  color: var(--theme-text-secondary);
  margin: var(--theme-space-md) 0;
}

.home__cta {
  display: flex;
  gap: var(--theme-space-md);
  margin-top: var(--theme-space-lg);
}
</style>
