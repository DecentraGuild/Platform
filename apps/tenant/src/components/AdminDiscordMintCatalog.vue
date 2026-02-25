<template>
  <Card class="discord-mint-catalog">
    <h3 class="discord-mint-catalog__title">Mint catalog</h3>
    <p class="discord-mint-catalog__hint">
      Configure the SPL tokens and NFT collections this dGuild uses for Discord rules.
      Define them once here, then pick them from dropdowns when creating rules. The first three mints are
      usually enough; adding more may increase RPC and indexing costs over time.
    </p>

    <div v-if="catalogLoading" class="discord-mint-catalog__loading">
      <Icon icon="mdi:loading" class="discord-mint-catalog__spinner" />
      Loading mints…
    </div>

    <div v-else>
      <p class="discord-mint-catalog__count">
        Mints configured: {{ catalogMints.length }}
      </p>

      <table v-if="catalogMints.length" class="discord-mint-catalog__table">
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Type</th>
            <th scope="col">Decimals</th>
            <th scope="col">Mint / collection</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mint in catalogMints" :key="mint.id">
            <td>
              <div class="discord-mint-catalog__label-cell">
                <span class="discord-mint-catalog__label">{{ mint.label }}</span>
                <span v-if="mint.symbol" class="discord-mint-catalog__symbol">({{ mint.symbol }})</span>
              </div>
            </td>
            <td>
              <span class="discord-mint-catalog__kind-badge">
                {{ mint.kind === 'SPL' ? 'SPL token' : 'NFT / collection' }}
              </span>
            </td>
            <td class="discord-mint-catalog__decimals">
              {{ mint.kind === 'SPL' && mint.decimals != null ? mint.decimals : '—' }}
            </td>
            <td class="discord-mint-catalog__asset">
              {{ truncate(mint.asset_id) }}
            </td>
            <td class="discord-mint-catalog__actions">
              <Button
                variant="ghost"
                size="small"
                :disabled="deletePending[mint.id]"
                @click="onDelete(mint.id)"
              >
                <Icon v-if="deletePending[mint.id]" icon="mdi:loading" class="discord-mint-catalog__btn-spin" />
                <Icon v-else icon="mdi:delete" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="discord-mint-catalog__add">
        <h4 class="discord-mint-catalog__add-title">Add mint</h4>
        <div class="discord-mint-catalog__add-row">
          <TextInput
            v-model="newMint"
            placeholder="Mint or collection address"
            class="discord-mint-catalog__mint-input"
          />
          <select
            v-model="newKind"
            class="discord-mint-catalog__select discord-mint-catalog__select--themed"
          >
            <option value="auto">Auto-detect type</option>
            <option value="SPL">SPL token</option>
            <option value="NFT">NFT / collection</option>
          </select>
          <Button
            variant="secondary"
            :disabled="!canSubmit || creating"
            @click="onCreate"
          >
            <Icon
              v-if="creating"
              icon="mdi:loading"
              class="discord-mint-catalog__btn-spin"
            />
            {{ creating ? 'Loading…' : 'Load' }}
          </Button>
        </div>
        <p v-if="createError" class="discord-mint-catalog__error discord-mint-catalog__error--inline">
          {{ createError }}
        </p>
        <p class="discord-mint-catalog__fine-print">
          We fetch metadata and holder snapshots in the background. If detection fails, choose SPL or NFT explicitly
          and try again.
        </p>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { API_V1 } from '~/utils/apiBase'
import { Card, TextInput, Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'

export interface CatalogMint {
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

const props = defineProps<{
  slug: string
  catalogMints: CatalogMint[]
  catalogLoading: boolean
}>()
const emit = defineEmits<{ 'mints-changed': [] }>()
const apiBase = useApiBase()

const creating = ref(false)
const createError = ref<string | null>(null)
const newMint = ref('')
const newKind = ref<'auto' | 'SPL' | 'NFT'>('auto')
const deletePending = ref<Record<number, boolean>>({})

const canSubmit = computed(
  () => newMint.value.trim().length >= 32 && !creating.value
)

function truncate(addr: string, head = 4, tail = 4): string {
  const v = addr.trim()
  if (!v || v.length <= head + tail) return v
  return `${v.slice(0, head)}…${v.slice(-tail)}`
}

async function onCreate() {
  const asset = newMint.value.trim()
  if (!asset || asset.length < 32) return
  creating.value = true
  createError.value = null
  try {
    const body: Record<string, unknown> = { asset_id: asset }
    if (newKind.value !== 'auto') {
      body.kind = newKind.value
    }
    const res = await fetch(
      `${apiBase.value}${API_V1}/tenant/${props.slug}/discord/mints`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      }
    )
    const data = (await res.json().catch(() => ({}))) as
      | (CatalogMint & { error?: string })
      | { error?: string }
    if (!res.ok) {
      createError.value =
        (data as { error?: string }).error ??
        `Failed to add mint (${res.status})`
      return
    }
    newMint.value = ''
    newKind.value = 'auto'
    emit('mints-changed')
  } finally {
    creating.value = false
  }
}

async function onDelete(id: number) {
  deletePending.value = { ...deletePending.value, [id]: true }
  createError.value = null
  try {
    const res = await fetch(
      `${apiBase.value}${API_V1}/tenant/${props.slug}/discord/mints/${id}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    )
    const body = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
    if (!res.ok || body.ok === false) {
      createError.value =
        body.error ??
        `Failed to delete mint from catalog (${res.status})`
      return
    }
    emit('mints-changed')
  } finally {
    deletePending.value = { ...deletePending.value, [id]: false }
  }
}
</script>

<style scoped>
.discord-mint-catalog {
  margin-top: var(--theme-space-lg);
}

.discord-mint-catalog__title {
  margin-bottom: var(--theme-space-xs);
}

.discord-mint-catalog__hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted, #666);
  margin-bottom: var(--theme-space-md);
}

.discord-mint-catalog__loading {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
}

.discord-mint-catalog__spinner {
  animation: discord-mint-spin 1s linear infinite;
}

@keyframes discord-mint-spin {
  to {
    transform: rotate(360deg);
  }
}

.discord-mint-catalog__count {
  font-size: var(--theme-font-sm);
  margin-bottom: var(--theme-space-sm);
}

.discord-mint-catalog__error {
  padding: var(--theme-space-sm);
  margin: 0 0 var(--theme-space-sm);
  background: var(--theme-surface-error, #fef2f2);
  color: var(--theme-text-error, #b91c1c);
  border-radius: var(--theme-radius-md, 4px);
  font-size: var(--theme-font-sm);
}

.discord-mint-catalog__error--inline {
  margin-top: var(--theme-space-xs);
}

.discord-mint-catalog__table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--theme-space-md);
}

.discord-mint-catalog__table th,
.discord-mint-catalog__table td {
  text-align: left;
  padding: var(--theme-space-xs) var(--theme-space-sm);
  font-size: var(--theme-font-sm);
}

.discord-mint-catalog__table thead {
  border-bottom: 1px solid var(--theme-border, #eee);
}

.discord-mint-catalog__label-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--theme-space-xs);
}

.discord-mint-catalog__label {
  font-weight: 500;
}

.discord-mint-catalog__symbol {
  color: var(--theme-text-muted, #666);
}

.discord-mint-catalog__decimals {
  font-variant-numeric: tabular-nums;
}

.discord-mint-catalog__kind-badge {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--theme-space-xs);
  border-radius: var(--theme-radius-pill, 999px);
  border: 1px solid var(--theme-border, #ddd);
  font-size: var(--theme-font-xs, 11px);
  text-transform: uppercase;
}

.discord-mint-catalog__asset {
  font-family: var(--theme-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        'Liberation Mono', 'Courier New', monospace);
  font-size: var(--theme-font-xs, 11px);
}

.discord-mint-catalog__actions {
  text-align: right;
}

.discord-mint-catalog__add {
  margin-top: var(--theme-space-md);
  border-top: 1px solid var(--theme-border, #eee);
  padding-top: var(--theme-space-md);
}

.discord-mint-catalog__add-title {
  font-size: var(--theme-font-md);
  margin-bottom: var(--theme-space-sm);
}

.discord-mint-catalog__add-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--theme-space-sm);
  align-items: center;
}

.discord-mint-catalog__mint-input {
  flex: 1;
  min-width: 180px;
}

.discord-mint-catalog__select {
  padding: var(--theme-space-sm) var(--theme-space-md);
  border-radius: 4px;
  border: 1px solid var(--theme-border, #ccc);
}

.discord-mint-catalog__select--themed {
  color: var(--theme-text-primary, #111);
  background-color: var(--theme-bg-primary, #fff);
  border-color: var(--theme-border, #ccc);
}

.discord-mint-catalog__select--themed option {
  color: var(--theme-text-primary, #111);
  background-color: var(--theme-bg-primary, #fff);
}

.discord-mint-catalog__fine-print {
  margin-top: var(--theme-space-xs);
  font-size: var(--theme-font-xs, 11px);
  color: var(--theme-text-muted, #666);
}

.discord-mint-catalog__btn-spin {
  animation: discord-mint-btn-spin 0.8s linear infinite;
}

@keyframes discord-mint-btn-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

