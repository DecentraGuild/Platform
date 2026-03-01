<template>
  <PageSection title="Discord">
    <div class="discord-page__layout">
      <div v-if="!discordVisible" class="discord-page__inactive">
        <p>Discord is not enabled for this dGuild.</p>
      </div>
      <Card v-else class="discord-page__card">
        <p v-if="discordDeactivating" class="discord-page__banner">
          Discord module is winding down. You can unlink wallets only.
        </p>
        <p class="discord-page__intro">
          Your Discord link and linked wallets are shared across all communities. Role eligibility is based on the combined holdings of all linked wallets.
        </p>
        <p v-if="discordServerInviteLink" class="discord-page__server-invite">
          <a :href="discordServerInviteLink" target="_blank" rel="noopener" class="discord-page__server-invite-link">
            Join our Discord
          </a>
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
              v-if="!discordDeactivating"
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

      <aside v-if="discordVisible && roleCards.length > 0" class="discord-page__carousel">
        <DiscordRoleCardsCarousel :role-cards="roleCards" />
      </aside>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
import { getModuleState, isModuleVisibleToMembers } from '@decentraguild/core'
import { PageSection, Card, Button, ConnectWalletModal } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import {
  getConnectorState,
  connectWallet,
  signMessageForAuth,
  subscribeToConnectorState,
} from '@decentraguild/web3/wallet'
import type { WalletConnectorId } from '@solana/connector/headless'
import { API_V1 } from '~/utils/apiBase'
import { useApiBase } from '~/composables/useApiBase'
import DiscordRoleCardsCarousel from '~/components/DiscordRoleCardsCarousel.vue'
import type { RoleCard } from '~/components/DiscordRoleCardsCarousel.vue'
import { useTenantStore } from '~/stores/tenant'

const apiBase = useApiBase()
const tenantStore = useTenantStore()
const tenant = computed(() => tenantStore.tenant)
const discordState = computed(() => getModuleState(tenant.value?.modules?.discord))
const discordVisible = computed(() => isModuleVisibleToMembers(discordState.value))
const discordDeactivating = computed(() => discordState.value === 'deactivating')
const discordServerInviteLink = computed(() => {
  const link = tenant.value?.discordServerInviteLink
  return link && link.trim() ? link.trim() : ''
})

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
const roleCards = ref<RoleCard[]>([])

const connectorState = ref(getConnectorState())

function truncate(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

async function fetchMe() {
  loadingMe.value = true
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/discord/me`, { credentials: 'include' })
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

async function fetchRoleCards() {
  const slug = tenantStore.slug
  if (!slug) return
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${encodeURIComponent(slug)}/discord/role-cards`, {
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as { role_cards: RoleCard[] }
    roleCards.value = data.role_cards ?? []
  } catch {
    roleCards.value = []
  }
}

async function doLinkAdditionalWallet(wallet: string) {
  const base = apiBase.value.replace(/\/$/, '')
  const nonceRes = await fetch(`${base}${API_V1}/auth/nonce`, {
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
  const slug = tenantStore.slug ?? undefined
  const linkRes = await fetch(`${base}${API_V1}/discord/link-additional-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, message, signature, tenant_slug: slug }),
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
    await fetchRoleCards()
  } catch (e) {
    addError.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    addingWallet.value = false
  }
}

async function revokeWallet(addr: string) {
  revoking.value = addr
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/discord/verify/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: addr }),
      credentials: 'include',
    })
    if (res.ok) {
      await fetchMe()
      await fetchRoleCards()
    }
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
  fetchRoleCards()
})
onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.discord-page__inactive {
  padding: var(--theme-space-lg);
  color: var(--theme-text-muted);
}

.discord-page__banner {
  padding: var(--theme-space-md);
  margin-bottom: var(--theme-space-md);
  background: var(--theme-status-warning, #ecc94b);
  color: var(--theme-text-primary);
  font-size: var(--theme-font-sm);
}

.discord-page__layout {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-xl);
}

@media (min-width: var(--theme-breakpoint-md)) {
  .discord-page__layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

.discord-page__card {
  max-width: 36rem;
  flex-shrink: 0;
}

.discord-page__carousel {
  flex: 1;
  min-width: 0;
}

.discord-page__intro {
  margin-bottom: var(--theme-space-md);
  color: var(--theme-text-secondary);
}

.discord-page__server-invite {
  margin: 0 0 var(--theme-space-md);
}

.discord-page__server-invite-link {
  color: var(--theme-primary);
  text-decoration: none;
}

.discord-page__server-invite-link:hover {
  text-decoration: underline;
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
