<template>
  <PageSection title="Discord">
    <Card class="discord-page__card">
      <p class="discord-page__intro">
        Your Discord link and linked wallets are shared across all communities. Role eligibility is based on the combined holdings of all linked wallets.
      </p>

      <template v-if="loadingMe">
        <p class="discord-page__loading">
          <Icon icon="mdi:loading" class="discord-page__spinner" />
          Loading…
        </p>
      </template>

      <template v-else-if="!signedIn">
        <p class="discord-page__hint">Sign in with your wallet to see your linked Discord and wallets.</p>
      </template>

      <template v-else-if="!me?.discord_user_id">
        <p class="discord-page__hint">
          You have not linked a wallet to Discord yet. Use <strong>/verify</strong> in your community's Discord server to get a link, then complete the flow to link this (or another) wallet.
        </p>
      </template>

      <template v-else>
        <div class="discord-page__section">
          <h3 class="discord-page__heading">Linked to Discord</h3>
          <p class="discord-page__id">Account ID: <code>{{ me.discord_user_id }}</code></p>
        </div>

        <div class="discord-page__section">
          <h3 class="discord-page__heading">Linked wallets ({{ me.linked_wallets?.length ?? 0 }})</h3>
          <p class="discord-page__hint-small">Holdings from these wallets are combined for role rules.</p>
          <ul v-if="me.linked_wallets?.length" class="discord-page__wallets">
            <li
              v-for="addr in me.linked_wallets"
              :key="addr"
              class="discord-page__wallet-row"
            >
              <code class="discord-page__address">{{ truncate(addr) }}</code>
              <span v-if="addr === me.session_wallet" class="discord-page__badge">Current</span>
              <Button
                variant="ghost"
                size="small"
                :disabled="revoking === addr"
                @click="revokeWallet(addr)"
              >
                Unlink
              </Button>
            </li>
          </ul>
          <p v-else class="discord-page__hint-small">No wallets linked.</p>

          <Button
            variant="secondary"
            size="small"
            :disabled="addingWallet"
            class="discord-page__add"
            @click="showConnectModal = true"
          >
            <Icon v-if="addingWallet" icon="mdi:loading" class="discord-page__spinner" />
            Link another wallet
          </Button>
          <p v-if="addError" class="discord-page__error">{{ addError }}</p>
        </div>

        <ConnectWalletModal
          :open="showConnectModal"
          title="Link another wallet"
          description="Connect a wallet to add it to your Discord account. Its holdings will be combined with your other linked wallets for roles."
          :connectors="connectorState.connectors"
          :loading="addingWallet"
          :error="addError"
          @close="showConnectModal = false; addError = null"
          @select="handleAddWallet"
        />
      </template>
    </Card>
  </PageSection>
</template>

<script setup lang="ts">
import { PageSection, Card, Button, ConnectWalletModal } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import {
  getConnectorState,
  connectWallet,
  signMessageForAuth,
  subscribeToConnectorState,
} from '@decentraguild/web3/wallet'
import type { WalletConnectorId } from '@solana/connector/headless'
import { useApiBase } from '~/composables/useApiBase'

const apiBase = useApiBase()

interface DiscordMe {
  discord_user_id: string | null
  linked_wallets: string[]
  session_wallet: string
}

const me = ref<DiscordMe | null>(null)
const loadingMe = ref(true)
const signedIn = ref(false)
const showConnectModal = ref(false)
const addingWallet = ref(false)
const addError = ref<string | null>(null)
const revoking = ref<string | null>(null)

const connectorState = ref(getConnectorState())

function truncate(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

async function fetchMe() {
  loadingMe.value = true
  try {
    const res = await fetch(`${apiBase.value}/api/v1/discord/me`, { credentials: 'include' })
    if (res.status === 401) {
      signedIn.value = false
      me.value = null
      return
    }
    signedIn.value = true
    const data = (await res.json()) as DiscordMe
    me.value = data
  } catch {
    me.value = null
  } finally {
    loadingMe.value = false
  }
}

async function doLinkAdditionalWallet(wallet: string) {
  const base = apiBase.value.replace(/\/$/, '')
  const nonceRes = await fetch(`${base}/api/v1/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet }),
    credentials: 'include',
  })
  if (!nonceRes.ok) {
    const data = await nonceRes.json().catch(() => ({}))
    throw new Error((data.error as string) ?? 'Failed to get nonce')
  }
  const { nonce } = (await nonceRes.json()) as { nonce: string }
  const { signature, message } = await signMessageForAuth(nonce)
  const linkRes = await fetch(`${base}/api/v1/discord/link-additional-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, message, signature }),
    credentials: 'include',
  })
  if (!linkRes.ok) {
    const data = await linkRes.json().catch(() => ({}))
    throw new Error((data.error as string) ?? 'Link failed')
  }
}

async function handleAddWallet(connectorId: WalletConnectorId) {
  addError.value = null
  addingWallet.value = true
  try {
    await connectWallet(connectorId)
    connectorState.value = getConnectorState()
    if (!connectorState.value.account) {
      addError.value = 'Wallet not connected'
      return
    }
    await doLinkAdditionalWallet(connectorState.value.account)
    showConnectModal.value = false
    await fetchMe()
  } catch (e) {
    addError.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    addingWallet.value = false
  }
}

async function revokeWallet(addr: string) {
  revoking.value = addr
  try {
    const res = await fetch(`${apiBase.value}/api/v1/discord/verify/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: addr }),
      credentials: 'include',
    })
    if (res.ok) await fetchMe()
  } finally {
    revoking.value = null
  }
}

let unsubscribe: (() => void) | null = null
onMounted(() => {
  unsubscribe = subscribeToConnectorState(() => {
    connectorState.value = getConnectorState()
  })
  fetchMe()
})
onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.discord-page__card {
  max-width: 36rem;
}

.discord-page__intro {
  margin-bottom: var(--theme-space-md);
  color: var(--theme-text-secondary);
}

.discord-page__loading,
.discord-page__hint {
  margin: var(--theme-space-md) 0;
}

.discord-page__section {
  margin-bottom: var(--theme-space-lg);
}

.discord-page__heading {
  font-size: var(--theme-font-md);
  margin-bottom: var(--theme-space-xs);
}

.discord-page__id {
  font-size: var(--theme-font-sm);
  word-break: break-all;
}

.discord-page__hint-small {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  margin-bottom: var(--theme-space-sm);
}

.discord-page__wallets {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--theme-space-md);
}

.discord-page__wallet-row {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-xs);
}

.discord-page__address {
  font-size: var(--theme-font-sm);
}

.discord-page__badge {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
  margin-left: var(--theme-space-xs);
}

.discord-page__add {
  margin-top: var(--theme-space-xs);
}

.discord-page__error {
  color: var(--theme-error, #c00);
  font-size: var(--theme-font-sm);
  margin-top: var(--theme-space-sm);
}

.discord-page__spinner {
  vertical-align: middle;
  margin-right: var(--theme-space-xs);
}
</style>
