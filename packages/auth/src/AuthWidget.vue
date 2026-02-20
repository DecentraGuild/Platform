<template>
  <div class="auth-widget">
    <template v-if="showAuthState && wallet">
      <span class="auth-widget__address">{{ truncatedAddress }}</span>
      <Button variant="secondary" @click="handleSignOut">
        Sign out
      </Button>
    </template>
    <template v-else>
      <Button variant="secondary" @click="showConnectModal = true">
        Connect wallet
      </Button>
      <ConnectWalletModal
        v-if="showAuthState"
        :open="showConnectModal"
        title="Connect wallet"
        description="Choose a wallet to sign in."
        :connectors="connectorState.connectors"
        :loading="loading"
        :error="error"
        @close="showConnectModal = false"
        @select="handleConnect"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Button, ConnectWalletModal } from '@decentraguild/ui/components'
import type { WalletConnectorId } from '@solana/connector/headless'
import { subscribeToConnectorState } from '@decentraguild/web3'
import { useAuth, openConnectModalRequested } from './useAuth'

const auth = useAuth()
const { wallet, loading, error, connectorState, fetchMe, refreshConnectorState, connectAndSignIn, signOut } = auth

const showConnectModal = ref(false)
/** Only show wallet/connect state after mount so server and client first paint match (avoids hydration mismatch). */
const showAuthState = ref(false)

watch(openConnectModalRequested, (v) => {
  if (v) {
    showConnectModal.value = true
    openConnectModalRequested.value = false
  }
})

const truncatedAddress = computed(() => {
  const w = wallet.value
  if (!w || w.length < 10) return w ?? ''
  return `${w.slice(0, 4)}...${w.slice(-4)}`
})

let unsubscribeConnector: (() => void) | null = null
onMounted(async () => {
  await fetchMe()
  refreshConnectorState()
  unsubscribeConnector = subscribeToConnectorState(() => {
    refreshConnectorState()
  })
  showAuthState.value = true
})
onUnmounted(() => {
  unsubscribeConnector?.()
})

async function handleConnect(connectorId: WalletConnectorId) {
  const ok = await connectAndSignIn(connectorId)
  if (ok) showConnectModal.value = false
}

async function handleSignOut() {
  await signOut()
}
</script>

<style scoped>
.auth-widget {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
}

.auth-widget__address {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}
</style>
