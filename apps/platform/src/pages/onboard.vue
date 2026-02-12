<template>
  <PageSection title="Create org">
    <Card>
      <template v-if="!auth.wallet.value">
        <p class="onboard-form__prompt">
          Connect your wallet and sign in to create a dGuild.
        </p>
        <Button variant="primary" @click="showConnectModal = true">
          Connect wallet
        </Button>
        <ConnectWalletModal
          :open="showConnectModal"
          title="Connect wallet"
          description="Choose a wallet to sign in and create your dGuild."
          :connectors="auth.connectorState.value.connectors"
          :loading="auth.loading.value"
          :error="auth.error.value"
          @close="showConnectModal = false"
          @select="handleConnectAndSignIn"
        />
      </template>
      <form v-else class="onboard-form" @submit.prevent="submit">
        <TextInput v-model="form.slug" label="Slug" placeholder="my-dguild" />
        <TextInput v-model="form.name" label="Name" placeholder="My dGuild" />
        <TextInput v-model="form.description" label="Description" placeholder="Our community hub" />
        <TextInput v-model="form.logo" label="Logo URL" placeholder="https://..." />
        <TextInput v-model="form.primaryColor" label="Primary color (hex)" placeholder="#00951a" />
        <div v-if="error" class="onboard-form__error">{{ error }}</div>
        <Button type="submit" variant="primary" :disabled="saving">Create</Button>
      </form>
    </Card>
  </PageSection>
</template>

<script setup lang="ts">
import { useAuth } from '@decentraguild/auth'
import { PageSection, Card, TextInput, Button, ConnectWalletModal } from '@decentraguild/ui/components'
import type { WalletConnectorId } from '@solana/connector/headless'

const auth = useAuth()
const config = useRuntimeConfig()
const router = useRouter()
const showConnectModal = ref(false)

onMounted(() => {
  auth.fetchMe()
  auth.refreshConnectorState()
})

const form = reactive({
  slug: '',
  name: '',
  description: '',
  logo: '',
  primaryColor: '#00951a',
})
const saving = ref(false)
const error = ref<string | null>(null)

async function handleConnectAndSignIn(connectorId: WalletConnectorId) {
  const ok = await auth.connectAndSignIn(connectorId)
  if (ok) showConnectModal.value = false
}

async function submit() {
  if (!auth.wallet.value) return
  if (!form.slug || !form.name) {
    error.value = 'Slug and name are required'
    return
  }
  saving.value = true
  error.value = null
  try {
    const res = await fetch(`${config.public.apiUrl}/api/v1/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        slug: form.slug,
        name: form.name,
        description: form.description || undefined,
        branding: {
          logo: form.logo || undefined,
          theme: form.primaryColor ? { colors: { primary: { main: form.primaryColor } } } : undefined,
        },
        modules: [{ id: 'admin', enabled: true }],
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to create')
    }
    await router.push('/directory')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create org'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.onboard-form__prompt {
  margin-bottom: var(--theme-space-md);
  color: var(--theme-text-secondary);
}

.onboard-form {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-md);
}

.onboard-form__error {
  color: var(--theme-error);
  font-size: var(--theme-font-sm);
}
</style>
