<template>
  <div class="verify-page">
    <Card class="verify-page__card">
      <h1 class="verify-page__title">Link wallet to Discord</h1>

      <template v-if="!token">
        <p class="verify-page__error">Invalid link. Use /verify in your Discord server to get a new link.</p>
      </template>

      <template v-else-if="sessionError">
        <p class="verify-page__error">{{ sessionError }}</p>
      </template>

      <template v-else-if="success">
        <p class="verify-page__success">Wallet linked. You can close this page and return to Discord.</p>
      </template>

      <template v-else>
        <p class="verify-page__intro">
          Connect your wallet to link it to your Discord account for role verification.
        </p>
        <Button
          variant="primary"
          :disabled="loading"
          @click="connectedWallet ? doLink(connectedWallet) : (showConnectModal = true)"
        >
          <Icon v-if="loading" icon="mdi:loading" class="verify-page__spinner" />
          {{ connectedWallet ? 'Link this wallet' : 'Connect wallet' }}
        </Button>
        <p v-if="linkError" class="verify-page__error">{{ linkError }}</p>

        <ConnectWalletModal
          :open="showConnectModal"
          title="Connect wallet"
          description="Choose a wallet to link to your Discord account."
          :connectors="connectorState.connectors"
          :loading="loading"
          :error="linkError"
          @close="showConnectModal = false"
          @select="handleConnect"
        />
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Card, Button, ConnectWalletModal } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import {
  getConnectorState,
  connectWallet,
  signMessageForAuth,
  subscribeToConnectorState,
} from '@decentraguild/web3/wallet'
import type { WalletConnectorId } from '@solana/connector/headless'
import { useApiBase } from '~/composables/useApiBase'

const route = useRoute()
const apiBase = useApiBase()

const token = computed(() => (route.query.token as string) ?? '')

const showConnectModal = ref(false)
const loading = ref(false)
const sessionError = ref<string | null>(null)
const linkError = ref<string | null>(null)
const success = ref(false)

const connectorState = ref(getConnectorState())
const connectedWallet = computed(() => connectorState.value.account)

let unsubscribe: (() => void) | null = null
onMounted(() => {
  unsubscribe = subscribeToConnectorState(() => {
    connectorState.value = getConnectorState()
  })
  if (token.value) {
    checkSession()
  }
})
onUnmounted(() => {
  unsubscribe?.()
})

async function checkSession() {
  if (!token.value) return
  try {
    const res = await fetch(
      `${apiBase.value}/api/v1/discord/verify/session?token=${encodeURIComponent(token.value)}`,
      { credentials: 'include' }
    )
    if (!res.ok) {
      sessionError.value = 'This link is invalid or has expired.'
      return
    }
    const data = (await res.json()) as { valid?: boolean }
    if (!data.valid) {
      sessionError.value = 'This link has expired. Use /verify in Discord to get a new one.'
    }
  } catch {
    sessionError.value = 'Could not verify link. Check your connection.'
  }
}

async function doLink(wallet: string) {
  if (!token.value) return
  linkError.value = null
  loading.value = true
  try {
    const base = apiBase.value.replace(/\/$/, '')

    const nonceRes = await fetch(`${base}/api/v1/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
      credentials: 'include',
    })
    if (!nonceRes.ok) {
      const data = await nonceRes.json().catch(() => ({}))
      linkError.value = (data.error as string) ?? 'Failed to get nonce'
      return
    }
    const { nonce } = (await nonceRes.json()) as { nonce: string }

    const { signature, message } = await signMessageForAuth(nonce)

    const linkRes = await fetch(`${base}/api/v1/discord/verify/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verify_token: token.value,
        wallet,
        message,
        signature,
      }),
      credentials: 'include',
    })

    if (!linkRes.ok) {
      const data = await linkRes.json().catch(() => ({}))
      linkError.value = (data.error as string) ?? 'Link failed'
      return
    }
    success.value = true
    showConnectModal.value = false
  } catch (e) {
    linkError.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function handleConnect(connectorId: WalletConnectorId) {
  if (!token.value) return
  linkError.value = null
  loading.value = true
  try {
    await connectWallet(connectorId)
    connectorState.value = getConnectorState()
    if (!connectorState.value.account) {
      linkError.value = 'Wallet not connected'
      return
    }
    await doLink(connectorState.value.account)
  } catch (e) {
    linkError.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.verify-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 40vh;
  padding: var(--theme-space-lg);
}

.verify-page__card {
  max-width: 28rem;
  width: 100%;
}

.verify-page__title {
  font-size: var(--theme-font-lg);
  margin-bottom: var(--theme-space-md);
}

.verify-page__intro {
  margin-bottom: var(--theme-space-md);
  color: var(--theme-text-secondary);
}

.verify-page__success {
  color: var(--theme-success, #0a0);
}

.verify-page__error {
  color: var(--theme-error, #c00);
  margin-top: var(--theme-space-sm);
}

.verify-page__spinner {
  margin-right: var(--theme-space-xs);
  vertical-align: middle;
}
</style>
