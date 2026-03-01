<template>
  <PageSection>
    <h1>Link wallet to Discord</h1>
    <p v-if="message" class="verify-redirect__message">{{ message }}</p>
    <p v-else class="verify-redirect__hint">
      Redirecting to the verify page…
    </p>
  </PageSection>
</template>

<script setup lang="ts">
import { PageSection } from '@decentraguild/ui/components'

const route = useRoute()
const message = ref<string | null>(null)

onMounted(() => {
  const token = route.query.token as string | undefined
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  if (token && isLocalhost) {
    const tenantVerifyUrl = `http://localhost:3002/verify?token=${encodeURIComponent(token)}`
    window.location.href = tenantVerifyUrl
    return
  }

  if (!token) {
    message.value = 'Invalid link. Use /verify in your Discord server to get a new link.'
    return
  }

  message.value =
    "The verify page runs on your community's site (e.g. skull.dguild.org), not here. Use the link from your Discord server."
})
</script>

<style scoped>
.verify-redirect__message,
.verify-redirect__hint {
  color: var(--theme-text-secondary);
  margin-top: var(--theme-space-md);
}
</style>
