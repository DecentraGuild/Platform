<template>
  <PageSection>
    <Card>
      <template v-if="!auth.wallet.value">
        <h2 class="onboard-form__title">Create Organisation</h2>
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
        <h2 class="onboard-form__title">Create Organisation</h2>
        <TextInput v-model="form.name" label="Name (required)" placeholder="My dGuild" />
        <TextInput v-model="form.description" label="Description (required)" placeholder="Our community hub" />
        <TextInput v-model="form.logo" label="Logo (required)" placeholder="https://..." />
        <TextInput v-model="form.discordInviteLink" label="Discord invite link" placeholder="https://discord.gg/..." />
        <div v-if="error" class="onboard-form__error">{{ error }}</div>
        <Button type="submit" variant="primary" :disabled="saving">Create and pay</Button>
      </form>
    </Card>
  </PageSection>
</template>

<script setup lang="ts">
import { Connection, PublicKey } from '@solana/web3.js'
import { useAuth } from '@decentraguild/auth'
import {
  buildBillingTransfer,
  sendAndConfirmTransaction,
  getEscrowWalletFromConnector,
} from '@decentraguild/web3'
import { PageSection, Card, TextInput, Button, ConnectWalletModal } from '@decentraguild/ui/components'
import type { WalletConnectorId } from '@solana/connector/headless'

const auth = useAuth()
const apiBase = useApiBase()
const { rpcUrl, hasRpc } = useRpc()
const showConnectModal = ref(false)

onMounted(() => {
  auth.fetchMe()
  auth.refreshConnectorState()
})

const form = reactive({
  name: '',
  description: '',
  logo: '',
  discordInviteLink: '',
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
  if (!form.description?.trim()) {
    error.value = 'Description is required'
    return
  }
  if (!form.logo?.trim()) {
    error.value = 'Logo is required'
    return
  }
  if (!hasRpc.value || !rpcUrl.value) {
    error.value = 'RPC not configured. Set NUXT_PUBLIC_HELIUS_RPC.'
    return
  }

  saving.value = true
  error.value = null
  try {
    const base = apiBase.value
    const branding = { logo: form.logo.trim() }
    const intentRes = await fetch(`${base}/api/v1/register/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim(),
        branding,
        discordInviteLink: form.discordInviteLink?.trim() ?? undefined,
      }),
    })
    if (!intentRes.ok) {
      const data = (await intentRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Failed to create payment intent')
    }
    const intent = (await intentRes.json()) as {
      paymentId: string
      amountUsdc: number
      memo: string
      recipientAta: string
      tenantId: string
    }
    if (!intent.paymentId || !intent.amountUsdc || !intent.memo || !intent.recipientAta) {
      throw new Error('Invalid payment intent response')
    }

    const wallet = getEscrowWalletFromConnector()
    if (!wallet?.publicKey) throw new Error('Wallet not connected')
    const connection = new Connection(rpcUrl.value)
    const tx = buildBillingTransfer({
      payer: wallet.publicKey,
      amountUsdc: intent.amountUsdc,
      recipientAta: new PublicKey(intent.recipientAta),
      memo: intent.memo,
      connection,
    })
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      wallet,
      wallet.publicKey,
    )

    const confirmRes = await fetch(`${base}/api/v1/register/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        paymentId: intent.paymentId,
        txSignature,
      }),
    })
    if (!confirmRes.ok) {
      const data = (await confirmRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Failed to confirm registration')
    }
    const confirmData = (await confirmRes.json()) as { tenant?: { id: string; slug?: string | null } }
    const tenant = confirmData.tenant
    if (!tenant) throw new Error('No tenant returned')
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
.onboard-form__title {
  margin: 0 0 var(--theme-space-md);
  font-size: var(--theme-font-xl);
  font-weight: 600;
  color: var(--theme-text-primary);
}

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
