<template>
  <div class="escrow-redirect">
    <p>Redirecting to marketplace...</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()

const id = route.params.id as string
const slug = route.query.tenant as string | undefined
const query = slug ? { tenant: slug, escrow: id } : { escrow: id }
await navigateTo({ path: '/market', query }, { replace: true })
</script>

<style scoped>
.escrow-redirect {
  padding: var(--theme-space-xl);
  text-align: center;
  color: var(--theme-text-muted);
}
</style>
