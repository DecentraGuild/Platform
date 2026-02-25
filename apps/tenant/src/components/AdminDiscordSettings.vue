<template>
  <div class="discord-settings">
    <AdminDiscordServerCard
      :slug="slug"
      :loading="loading"
      :server="server"
      :invite-url="inviteUrl"
      v-model:guild-id-input="guildIdInput"
      :link-error="linkError"
      :linking="linking"
      :disconnecting="disconnecting"
      @link="onLink"
      @disconnect="disconnect"
    />
    <AdminDiscordMintCatalog
      v-if="server.connected && !loading"
      :slug="slug"
      :catalog-mints="catalogMints"
      :catalog-loading="catalogMintsLoading"
      @mints-changed="fetchMints"
    />
    <AdminDiscordRulesCard
      v-if="server.connected && !loading"
      :slug="slug"
      :catalog-mints="catalogMints"
    />
  </div>
</template>

<script setup lang="ts">
import { API_V1 } from '~/utils/apiBase'
import AdminDiscordServerCard from '~/components/AdminDiscordServerCard.vue'
import AdminDiscordRulesCard from '~/components/AdminDiscordRulesCard.vue'
import AdminDiscordMintCatalog from '~/components/AdminDiscordMintCatalog.vue'

interface CatalogMint {
  id: number
  asset_id: string
  kind: 'SPL' | 'NFT'
  label: string
  symbol: string | null
  image: string | null
  decimals: number | null
  trait_keys: string[] | null
  trait_options: Record<string, string[]> | null
}

const props = defineProps<{ slug: string }>()
const apiBase = useApiBase()

const loading = ref(true)
const catalogMints = ref<CatalogMint[]>([])
const catalogMintsLoading = ref(false)
const inviteUrl = ref<string | null>(null)
const server = ref<{
  connected: boolean
  discord_guild_id?: string
  guild_name?: string | null
  connected_at?: string
}>({ connected: false })
const guildIdInput = ref('')
const linking = ref(false)
const disconnecting = ref(false)
const linkError = ref<string | null>(null)

async function fetchInviteUrl() {
  const res = await fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/invite-url`, {
    credentials: 'include',
  })
  if (res.ok) {
    const data = (await res.json()) as { invite_url?: string | null }
    inviteUrl.value = data.invite_url ?? null
  }
}

async function fetchServer() {
  const res = await fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/server`, {
    credentials: 'include',
  })
  if (res.ok) {
    const data = (await res.json()) as {
      connected: boolean
      discord_guild_id?: string
      guild_name?: string
      connected_at?: string
    }
    server.value = {
      connected: data.connected,
      discord_guild_id: data.discord_guild_id,
      guild_name: data.guild_name,
      connected_at: data.connected_at,
    }
  }
}

async function fetchMints() {
  if (!server.value.connected) return
  catalogMintsLoading.value = true
  try {
    const res = await fetch(
      `${apiBase.value}${API_V1}/tenant/${props.slug}/discord/mints`,
      { credentials: 'include' }
    )
    if (res.ok) {
      const data = (await res.json()) as { mints?: CatalogMint[] }
      catalogMints.value = data.mints ?? []
    } else {
      catalogMints.value = []
    }
  } finally {
    catalogMintsLoading.value = false
  }
}

async function load() {
  loading.value = true
  linkError.value = null
  try {
    await Promise.all([fetchInviteUrl(), fetchServer()])
    if (server.value.connected) {
      await fetchMints()
    }
  } finally {
    loading.value = false
  }
}

async function onLink(payload: { guildId: string }) {
  const id = payload.guildId
  if (!id) return
  linking.value = true
  linkError.value = null
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/server`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ discord_guild_id: id }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      connected?: boolean
      discord_guild_id?: string
      guild_name?: string
      connected_at?: string
    }
    if (!res.ok) {
      linkError.value = data.error ?? 'Failed to link server'
      return
    }
    server.value = {
      connected: data.connected ?? true,
      discord_guild_id: data.discord_guild_id,
      guild_name: data.guild_name,
      connected_at: data.connected_at,
    }
    guildIdInput.value = ''
    await fetchMints()
  } finally {
    linking.value = false
  }
}

async function disconnect() {
  disconnecting.value = true
  try {
    const res = await fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/server`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      const data = (await res.json()) as { connected: boolean }
      server.value = { connected: data.connected ?? false }
    }
  } finally {
    disconnecting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.discord-settings {
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>
