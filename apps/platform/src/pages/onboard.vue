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
const apiBase = useApiBase()
const router = useRouter()
const showConnectModal = ref(false)

onMounted(() => {
  auth.fetchMe()
  auth.refreshConnectorState()
})

const form = reactive({
  name: '',
  description: '',
  logo: '',
  primaryColor: '#00951a',
})

const config = useRuntimeConfig()
const saving = ref(false)
const error = ref<string | null>(null)

async function handleConnectAndSignIn(connectorId: WalletConnectorId) {
  const ok = await auth.connectAndSignIn(connectorId)
  if (ok) showConnectModal.value = false
}

async function submit() {
  if (!auth.wallet.value) return
  if (!form.name?.trim()) {
    error.value = 'Name is required'
    return
  }
  saving.value = true
  error.value = null
  try {
    const base = apiBase.value
    const res = await fetch(`${base}/api/v1/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        branding: {
          logo: form.logo?.trim() || undefined,
          theme: form.primaryColor ? { colors: { primary: { main: form.primaryColor } } } : undefined,
        },
        modules: [{ id: 'admin', enabled: true }],
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to create')
    }
    const data = await res.json()
    const tenant = data.tenant as { id: string; slug?: string | null }
    const identifier = tenant.slug ?? tenant.id
    const tenantBaseDomain = config.public.tenantBaseDomain as string
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (isLocal) {
      window.location.href = `http://localhost:3002/admin?tenant=${encodeURIComponent(identifier)}`
    } else {
      window.location.href = `https://${identifier}.${tenantBaseDomain}/admin`
    }
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
