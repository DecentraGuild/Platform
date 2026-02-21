<template>
  <Card class="discord-rules-card">
    <h3>Role rules</h3>
    <p class="discord-rules-card__hint">
      Assign a Discord role when members meet conditions (SPL balance, NFT collection, trait, or Discord role). For SPL mints, click Load to fetch metadata first; the threshold is in token units. For NFT or Trait conditions, click Load to fetch and index all NFTs in the collection (required for Year 3 and other collections); trait options then appear as dropdowns. After each condition choose AND or OR before the next. Max 5 conditions per rule.
    </p>
    <p v-if="configuredMintCount !== null" class="discord-rules-card__mint-count">
      Mints used: {{ configuredMintCount }}{{ mintCap != null ? ` / ${mintCap}` : '' }}
    </p>
    <div v-if="rulesError" class="discord-rules-card__error">
      {{ rulesError }}
      <span class="discord-rules-card__error-hint">If the error mentions a missing table, ensure the API has run database migrations (they run on API startup when DATABASE_URL is set). Restart the API and try again.</span>
    </div>
    <div v-if="rulesLoading" class="discord-rules-card__loading">
      <Icon icon="mdi:loading" class="discord-rules-card__spinner" />
      Loading rules…
    </div>
    <template v-else>
      <ul v-if="rulesSorted.length" class="discord-rules-card__list">
        <li
          v-for="rule in rulesSorted"
          :key="rule.id"
          class="discord-rules-card__item"
        >
          <div class="discord-rules-card__summary">
            <span class="discord-rules-card__rule-name">{{ roleName(rule.discord_role_id) }}</span>
            <span class="discord-rules-card__sep">—</span>
            <span class="discord-rules-card__conditions">
              {{ rule.conditions.map(c => conditionSummary(c, c.logic_to_next ?? undefined)).join(' ') }}
            </span>
          </div>
          <div class="discord-rules-card__actions">
            <Button variant="ghost" size="small" @click="startEdit(rule)">
              <Icon icon="mdi:pencil" />
            </Button>
            <Button variant="ghost" size="small" @click="deleteRule(rule.id)">
              <Icon icon="mdi:delete" />
            </Button>
          </div>
        </li>
      </ul>
      <p v-else class="discord-rules-card__empty">No role rules. Add one below.</p>

      <div class="discord-rules-card__form">
        <h4>{{ editingRuleId ? 'Edit rule' : 'Add rule' }}</h4>
        <div class="discord-rules-card__form-row">
          <label class="discord-rules-card__label">Assign role</label>
          <select
            v-model="form.discord_role_id"
            class="discord-rules-card__select discord-rules-card__select--themed"
            :disabled="!!editingRuleId"
          >
            <option value="">Select role</option>
            <option
              v-for="r in assignableRoles"
              :key="r.id"
              :value="r.id"
            >
              {{ r.name }}
            </option>
          </select>
          <p v-if="assignableRoles.length === 0 && !rulesLoading" class="discord-rules-card__roles-hint">
            Roles are synced by the bot when it starts or joins the server. If the list is empty, ensure the bot is in your Discord server and has been restarted after you linked this server, then refresh this page.
          </p>
          <p v-else-if="assignableRoles.length > 0" class="discord-rules-card__roles-hint">
            Only roles the bot can assign are listed (those below its role in the server hierarchy). For conditions, you can use any server role in the "Discord role" condition type below.
          </p>
        </div>
        <div class="discord-rules-card__conditions-block">
          <label class="discord-rules-card__label">Conditions</label>
          <div
            v-for="(cond, idx) in form.conditions"
            :key="idx"
            class="discord-rules-card__condition-block"
          >
            <div class="discord-rules-card__condition-row">
              <select
                v-model="cond.type"
                class="discord-rules-card__select discord-rules-card__select--sm discord-rules-card__select--themed"
                @change="onConditionTypeChange(cond)"
              >
                <option v-for="t in conditionTypes" :key="t.id" :value="t.id">{{ t.label }}</option>
              </select>
              <template v-if="typeNeedsMint(cond.type)">
                <TextInput
                  v-model="cond.mint_or_group"
                  placeholder="Mint or collection address"
                  class="discord-rules-card__mint-input"
                />
                <Button
                  variant="secondary"
                  size="small"
                  :disabled="!cond.mint_or_group.trim() || cond.mint_or_group.trim().length < 32 || mintLoadPending[idx]"
                  :aria-label="'Load metadata for condition ' + (idx + 1)"
                  @click="loadMintPreview(idx)"
                >
                  <Icon v-if="mintLoadPending[idx]" icon="mdi:loading" class="discord-rules-card__btn-spin" />
                  {{ mintLoadPending[idx] ? 'Loading…' : 'Load' }}
                </Button>
                <TextInput
                  v-if="cond.type === 'SPL'"
                  v-model="cond.threshold"
                  type="number"
                  placeholder="Min amount"
                  class="discord-rules-card__threshold-input"
                />
                <template v-if="cond.type === 'TRAIT'">
                  <template v-if="traitOptionsByCondition[idx]?.trait_keys?.length">
                    <select
                      v-model="cond.trait_key"
                      class="discord-rules-card__select discord-rules-card__select--sm discord-rules-card__select--themed"
                      aria-label="Trait key"
                      @change="cond.trait_value = ''"
                    >
                      <option value="">Select trait</option>
                      <option
                        v-for="key in traitOptionsByCondition[idx]?.trait_keys ?? []"
                        :key="key"
                        :value="key"
                      >
                        {{ key }}
                      </option>
                    </select>
                    <select
                      v-model="cond.trait_value"
                      class="discord-rules-card__select discord-rules-card__select--sm discord-rules-card__select--themed"
                      aria-label="Trait value"
                    >
                      <option value="">Select value</option>
                      <option
                        v-for="val in traitValueOptions(idx)"
                        :key="val"
                        :value="val"
                      >
                        {{ val }}
                      </option>
                    </select>
                  </template>
                  <template v-else>
                    <TextInput v-model="cond.trait_key" placeholder="Trait key (load collection first)" class="discord-rules-card__trait-input" />
                    <TextInput v-model="cond.trait_value" placeholder="Trait value" class="discord-rules-card__trait-input" />
                    <span class="discord-rules-card__trait-hint">Click Load to fetch and index all NFTs in the collection; trait options will appear as dropdowns.</span>
                  </template>
                </template>
              </template>
              <template v-else-if="cond.type === 'DISCORD'">
                <div class="discord-rules-card__discord-roles">
                  <select
                    v-model="cond.required_role_ids"
                    multiple
                    class="discord-rules-card__select discord-rules-card__select--multi discord-rules-card__select--themed"
                    aria-label="Required Discord roles"
                  >
                    <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
                  </select>
                  <span class="discord-rules-card__role-logic-label">Member must have:</span>
                  <select v-model="cond.role_logic" class="discord-rules-card__select discord-rules-card__select--sm discord-rules-card__select--themed">
                    <option value="AND">All of the selected roles</option>
                    <option value="OR">Any of the selected roles</option>
                  </select>
                </div>
              </template>
              <select
                v-if="idx < form.conditions.length - 1"
                v-model="cond.logic_to_next"
                class="discord-rules-card__select discord-rules-card__select--sm discord-rules-card__select--themed"
                aria-label="Logic to next condition"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
              <Button variant="ghost" size="small" @click="removeCondition(idx)">
                <Icon icon="mdi:close" />
              </Button>
            </div>
            <div v-if="mintPreviews[idx]" class="discord-rules-card__mint-preview">
              <template v-if="mintPreviews[idx]?.name || mintPreviews[idx]?.symbol">
                <span class="discord-rules-card__mint-preview-name">{{ mintPreviews[idx]?.name ?? mintPreviews[idx]?.mint?.slice(0, 8) + '…' }}</span>
                <span v-if="mintPreviews[idx]?.symbol" class="discord-rules-card__mint-preview-symbol">{{ mintPreviews[idx]?.symbol }}</span>
              </template>
              <span v-if="mintPreviews[idx]?.decimals != null" class="discord-rules-card__mint-preview-meta">Decimals: {{ mintPreviews[idx]?.decimals }}</span>
              <span v-if="mintPreviews[idx]?.holder_count != null" class="discord-rules-card__mint-preview-holders">Holders: {{ mintPreviews[idx]?.holder_count }}</span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="small"
            :disabled="form.conditions.length >= 5"
            @click="addCondition"
          >
            Add condition
          </Button>
        </div>
        <div class="discord-rules-card__form-actions">
          <Button
            v-if="editingRuleId"
            variant="secondary"
            @click="cancelEdit"
          >
            Cancel
          </Button>
          <p v-if="ruleSaveError" class="discord-rules-card__error discord-rules-card__error--inline">
            {{ ruleSaveError }}
          </p>
          <Button
            variant="primary"
            :disabled="!form.discord_role_id || form.conditions.every(c => !isConditionFilled(c)) || savingRule"
            @click="saveRule"
          >
            {{ editingRuleId ? 'Update rule' : 'Add rule' }}
          </Button>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { Card, TextInput, Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'

const props = defineProps<{ slug: string }>()
const apiBase = useApiBase()

interface DiscordRole {
  id: string
  name: string
  position?: number
}
interface RuleCondition {
  id?: number
  type: string
  mint_or_group: string
  threshold?: number | null
  trait_key?: string | null
  trait_value?: string | null
  required_role_ids?: string[]
  role_logic?: 'AND' | 'OR'
  logic_to_next?: 'AND' | 'OR' | null
}
interface MintPreview {
  mint: string
  name: string | null
  symbol: string | null
  image: string | null
  decimals: number | null
  holder_count: number | null
}
interface TraitOptions {
  trait_keys: string[]
  trait_options: Record<string, string[]>
}
interface Rule {
  id: number
  discord_role_id: string
  operator: string
  conditions: Array<RuleCondition & { logic_to_next?: string | null }>
}

const roles = ref<DiscordRole[]>([])
const assignableRoles = ref<DiscordRole[]>([])
const rules = ref<Rule[]>([])
const rulesLoading = ref(false)
const rulesError = ref<string | null>(null)
const ruleSaveError = ref<string | null>(null)
const configuredMintCount = ref<number | null>(null)
const mintCap = ref<number | null>(null)
const editingRuleId = ref<number | null>(null)
const savingRule = ref(false)
const conditionTypes = ref<Array<{ id: string; label: string }>>([])
const form = reactive({
  discord_role_id: '',
  operator: 'AND' as 'AND' | 'OR',
  conditions: [] as Array<{
    type: string
    mint_or_group: string
    threshold?: string
    trait_key?: string
    trait_value?: string
    required_role_ids?: string[]
    role_logic?: 'AND' | 'OR'
    logic_to_next?: 'AND' | 'OR'
  }>,
})
const mintPreviews = ref<Record<number, MintPreview | null>>({})
const mintLoadPending = ref<Record<number, boolean>>({})
const traitOptionsByCondition = ref<Record<number, TraitOptions>>({})
const mintPreviewCache = ref<
  Record<string, { preview: MintPreview; traitOptions?: TraitOptions; isCollection: boolean }>
>({})

function typeNeedsMint(type: string): boolean {
  return type === 'SPL' || type === 'NFT' || type === 'TRAIT'
}
function onConditionTypeChange(cond: (typeof form.conditions)[number]) {
  if (cond.type === 'DISCORD' && !Array.isArray(cond.required_role_ids)) {
    cond.required_role_ids = []
    cond.role_logic = 'OR'
  }
}
function isConditionFilled(c: (typeof form.conditions)[number]): boolean {
  if (typeNeedsMint(c.type)) return !!c.mint_or_group?.trim()
  if (c.type === 'DISCORD') return (c.required_role_ids?.length ?? 0) > 0
  return false
}

const rulesSorted = computed(() => {
  const list = [...rules.value]
  return list.sort((a, b) => {
    const nameA = roleName(a.discord_role_id).toLowerCase()
    const nameB = roleName(b.discord_role_id).toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

async function loadMintPreview(idx: number) {
  const cond = form.conditions[idx]
  const mint = cond?.mint_or_group?.trim()
  if (!mint || mint.length < 32) return
  const isCollectionLoad = cond?.type === 'NFT' || cond?.type === 'TRAIT'
  const cacheKey = `${mint}:${isCollectionLoad ? 'collection' : 'mint'}`
  const cached = mintPreviewCache.value[cacheKey]
  if (cached) {
    mintPreviews.value = { ...mintPreviews.value, [idx]: cached.preview }
    if (cached.traitOptions)
      traitOptionsByCondition.value = { ...traitOptionsByCondition.value, [idx]: cached.traitOptions }
    return
  }
  mintLoadPending.value = { ...mintLoadPending.value, [idx]: true }
  try {
    if (isCollectionLoad) {
      const res = await fetch(
        `${apiBase.value}/api/v1/tenant/${props.slug}/discord/collection-preview?mint=${encodeURIComponent(mint)}&fetch=1`,
        { credentials: 'include' }
      )
      if (res.ok) {
        const data = (await res.json()) as {
          mint: string
          name: string | null
          image: string | null
          trait_keys: string[]
          trait_options: Record<string, string[]>
          items_loaded?: number
        }
        const preview: MintPreview = {
          mint: data.mint,
          name: data.name ?? null,
          symbol: null,
          image: data.image ?? null,
          decimals: null,
          holder_count: data.items_loaded ?? null,
        }
        const traitOptions: TraitOptions = { trait_keys: data.trait_keys ?? [], trait_options: data.trait_options ?? {} }
        mintPreviewCache.value = { ...mintPreviewCache.value, [cacheKey]: { preview, traitOptions, isCollection: true } }
        mintPreviews.value = { ...mintPreviews.value, [idx]: preview }
        traitOptionsByCondition.value = { ...traitOptionsByCondition.value, [idx]: traitOptions }
      } else {
        mintPreviews.value = { ...mintPreviews.value, [idx]: null }
        traitOptionsByCondition.value = { ...traitOptionsByCondition.value, [idx]: { trait_keys: [], trait_options: {} } }
      }
    } else {
      const res = await fetch(
        `${apiBase.value}/api/v1/tenant/${props.slug}/discord/mint-preview?mint=${encodeURIComponent(mint)}&fetch=1`,
        { credentials: 'include' }
      )
      if (res.ok) {
        const data = (await res.json()) as MintPreview & { holder_count?: number; decimals?: number }
        const preview: MintPreview = {
          mint: data.mint,
          name: data.name ?? null,
          symbol: data.symbol ?? null,
          image: data.image ?? null,
          decimals: data.decimals ?? null,
          holder_count: data.holder_count ?? null,
        }
        mintPreviewCache.value = { ...mintPreviewCache.value, [cacheKey]: { preview, isCollection: false } }
        mintPreviews.value = { ...mintPreviews.value, [idx]: preview }
      } else {
        mintPreviews.value = { ...mintPreviews.value, [idx]: null }
      }
    }
  } finally {
    mintLoadPending.value = { ...mintLoadPending.value, [idx]: false }
  }
}

function traitValueOptions(idx: number): string[] {
  const cond = form.conditions[idx]
  const key = cond?.trait_key?.trim()
  if (!key) return []
  const opts = traitOptionsByCondition.value[idx]
  if (!opts?.trait_options) return []
  return opts.trait_options[key] ?? []
}
function addCondition() {
  if (form.conditions.length >= 5) return
  const last = form.conditions[form.conditions.length - 1]
  if (last) last.logic_to_next = last.logic_to_next ?? 'AND'
  const defaultType = conditionTypes.value[0]?.id ?? 'SPL'
  form.conditions.push({
    type: defaultType,
    mint_or_group: '',
    logic_to_next: 'AND',
    ...(defaultType === 'DISCORD' ? { required_role_ids: [], role_logic: 'OR' as const } : {}),
  })
}
function removeCondition(idx: number) {
  form.conditions.splice(idx, 1)
  if (idx > 0 && form.conditions[idx - 1]) form.conditions[idx - 1]!.logic_to_next = 'AND'
  const prev: Record<number, MintPreview | null> = {}
  Object.entries(mintPreviews.value).forEach(([k, v]) => {
    const i = Number(k)
    if (i < idx) prev[i] = v as MintPreview | null
    else if (i > idx) prev[i - 1] = v as MintPreview | null
  })
  mintPreviews.value = prev
  const prevTraits: Record<number, TraitOptions> = {}
  Object.entries(traitOptionsByCondition.value).forEach(([k, v]) => {
    const i = Number(k)
    if (i < idx) prevTraits[i] = v
    else if (i > idx) prevTraits[i - 1] = v
  })
  traitOptionsByCondition.value = prevTraits
}
function resetForm() {
  form.discord_role_id = ''
  form.operator = 'AND'
  const defaultType = conditionTypes.value[0]?.id ?? 'SPL'
  form.conditions = [{
    type: defaultType,
    mint_or_group: '',
    logic_to_next: 'AND',
    ...(defaultType === 'DISCORD' ? { required_role_ids: [], role_logic: 'OR' as const } : {}),
  }]
  mintPreviews.value = {}
  traitOptionsByCondition.value = {}
  editingRuleId.value = null
}
function roleName(roleId: string): string {
  return roles.value.find((r) => r.id === roleId)?.name ?? roleId
}
function conditionSummary(c: RuleCondition, nextLogic?: string | null): string {
  if (c.type === 'DISCORD') {
    const ids = c.required_role_ids ?? []
    const names = ids.map((id) => roleName(id)).filter(Boolean)
    const logic = c.role_logic ?? 'OR'
    const base = `DISCORD ${names.length ? names.join(', ') : '(no roles)'} (${logic})`
    return nextLogic ? `${base} ${nextLogic}` : base
  }
  const parts = [c.type, c.mint_or_group]
  if (c.type === 'SPL' && c.threshold != null) parts.push(`>= ${c.threshold}`)
  if (c.type === 'TRAIT' && c.trait_key) parts.push(`${c.trait_key}=${c.trait_value ?? ''}`)
  const base = parts.join(' ')
  return nextLogic ? `${base} ${nextLogic}` : base
}

async function fetchRules() {
  rulesLoading.value = true
  rulesError.value = null
  try {
    const [typesRes, rolesRes, rulesRes] = await Promise.all([
      fetch(`${apiBase.value}/api/v1/tenant/${props.slug}/discord/condition-types`, { credentials: 'include' }),
      fetch(`${apiBase.value}/api/v1/tenant/${props.slug}/discord/roles`, { credentials: 'include' }),
      fetch(`${apiBase.value}/api/v1/tenant/${props.slug}/discord/rules`, { credentials: 'include' }),
    ])
    if (typesRes.ok) {
      const d = (await typesRes.json()) as { types?: Array<{ id: string; label: string }> }
      conditionTypes.value = d.types ?? []
    }
    if (conditionTypes.value.length === 0) {
      conditionTypes.value = [{ id: 'SPL', label: 'SPL' }, { id: 'NFT', label: 'NFT' }, { id: 'TRAIT', label: 'Trait' }, { id: 'DISCORD', label: 'Discord role' }]
    }
    if (rolesRes.ok) {
      const d = (await rolesRes.json()) as { roles?: DiscordRole[]; assignable_roles?: DiscordRole[] }
      roles.value = d.roles ?? []
      assignableRoles.value = d.assignable_roles ?? []
    }
    if (rulesRes.ok) {
      const d = (await rulesRes.json()) as { rules?: Rule[]; configured_mint_count?: number; mint_cap?: number | null }
      rules.value = d.rules ?? []
      configuredMintCount.value = d.configured_mint_count ?? 0
      mintCap.value = d.mint_cap ?? null
    } else {
      const errBody = (await rulesRes.json().catch(() => ({}))) as { error?: string }
      rulesError.value = errBody.error ?? `Failed to load rules (${rulesRes.status})`
    }
  } finally {
    rulesLoading.value = false
  }
}

function startEdit(rule: Rule) {
  editingRuleId.value = rule.id
  form.discord_role_id = rule.discord_role_id
  form.operator = rule.operator as 'AND' | 'OR'
  const defaultType = conditionTypes.value[0]?.id ?? 'SPL'
  form.conditions = rule.conditions.length
    ? rule.conditions.map((c, i) => ({
        type: c.type,
        mint_or_group: c.mint_or_group ?? '',
        threshold: c.threshold != null ? String(c.threshold) : '',
        trait_key: c.trait_key ?? '',
        trait_value: c.trait_value ?? '',
        required_role_ids: c.required_role_ids ?? [],
        role_logic: (c.role_logic ?? 'OR') as 'AND' | 'OR',
        logic_to_next: c.logic_to_next ?? (i < rule.conditions.length - 1 ? 'AND' : undefined),
      }))
    : [{ type: defaultType, mint_or_group: '', logic_to_next: 'AND', ...(defaultType === 'DISCORD' ? { required_role_ids: [], role_logic: 'OR' as const } : {}) }]
  mintPreviews.value = {}
  traitOptionsByCondition.value = {}
  nextTick(() => {
    form.conditions.forEach((c, idx) => {
      if (typeNeedsMint(c.type) && c.mint_or_group.trim()) loadMintPreview(idx)
    })
  })
}
function cancelEdit() {
  resetForm()
}

async function saveRule() {
  if (!form.discord_role_id || form.conditions.every((c) => !isConditionFilled(c))) return
  savingRule.value = true
  ruleSaveError.value = null
  try {
    const raw = form.conditions.filter((c) => isConditionFilled(c))
    const conditions = raw.map((c, i) => {
      const base = {
        type: c.type,
        logic_to_next: i < raw.length - 1 ? (c.logic_to_next === 'OR' ? 'OR' : 'AND') : null,
      }
      if (c.type === 'DISCORD') {
        return { ...base, required_role_ids: c.required_role_ids ?? [], role_logic: c.role_logic ?? 'OR' }
      }
      return {
        ...base,
        mint_or_group: c.mint_or_group.trim(),
        threshold: c.type === 'SPL' && c.threshold !== '' ? Number(c.threshold) : undefined,
        trait_key: c.trait_key?.trim() || undefined,
        trait_value: c.trait_value?.trim() || undefined,
      }
    })
    if (editingRuleId.value != null) {
      const res = await fetch(
        `${apiBase.value}/api/v1/tenant/${props.slug}/discord/rules/${editingRuleId.value}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ operator: form.operator, conditions }),
        }
      )
      if (res.ok) {
        await fetchRules()
      } else {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        ruleSaveError.value = errBody.error ?? `Failed to update rule (${res.status})`
      }
    } else {
      const res = await fetch(`${apiBase.value}/api/v1/tenant/${props.slug}/discord/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          discord_role_id: form.discord_role_id,
          operator: form.operator,
          conditions,
        }),
      })
      if (res.ok) {
        resetForm()
        await fetchRules()
      } else {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        ruleSaveError.value = errBody.error ?? `Failed to add rule (${res.status})`
      }
    }
  } finally {
    savingRule.value = false
  }
}

async function deleteRule(id: number) {
  const res = await fetch(`${apiBase.value}/api/v1/tenant/${props.slug}/discord/rules/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (res.ok) {
    if (editingRuleId.value === id) resetForm()
    await fetchRules()
  }
}

onMounted(() => {
  addCondition()
  fetchRules()
})
</script>

<style scoped>
.discord-rules-card {
  margin-top: var(--theme-space-lg);
}

.discord-rules-card__hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted, #666);
  margin-bottom: var(--theme-space-md);
}

.discord-rules-card__mint-count {
  font-size: var(--theme-font-sm);
  margin-bottom: var(--theme-space-md);
}

.discord-rules-card__loading {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
}

.discord-rules-card__spinner {
  animation: discord-rules-spin 1s linear infinite;
}

@keyframes discord-rules-spin {
  to { transform: rotate(360deg); }
}

.discord-rules-card__error {
  padding: var(--theme-space-md);
  margin-bottom: var(--theme-space-md);
  background: var(--theme-surface-error, #fef2f2);
  color: var(--theme-text-error, #b91c1c);
  border-radius: var(--theme-radius-md, 4px);
  font-size: var(--theme-font-sm);
}

.discord-rules-card__error-hint {
  display: block;
  margin-top: var(--theme-space-sm);
  color: var(--theme-text-muted, #666);
}

.discord-rules-card__error--inline {
  margin-top: var(--theme-space-sm);
  margin-bottom: 0;
}

.discord-rules-card__list {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--theme-space-lg);
}

.discord-rules-card__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-sm) 0;
  border-bottom: 1px solid var(--theme-border, #eee);
  gap: var(--theme-space-md);
}

.discord-rules-card__summary {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--theme-space-xs);
}

.discord-rules-card__rule-name {
  font-weight: 600;
}

.discord-rules-card__sep {
  margin: 0 var(--theme-space-xs);
  color: var(--theme-text-muted, #666);
}

.discord-rules-card__conditions {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted, #666);
}

.discord-rules-card__actions {
  display: flex;
  gap: var(--theme-space-xs);
}

.discord-rules-card__empty {
  margin-bottom: var(--theme-space-lg);
  color: var(--theme-text-muted, #666);
}

.discord-rules-card__form h4 {
  font-size: var(--theme-font-md);
  margin-bottom: var(--theme-space-md);
}

.discord-rules-card__form-row,
.discord-rules-card__conditions-block {
  margin-bottom: var(--theme-space-md);
}

.discord-rules-card__label {
  display: block;
  font-size: var(--theme-font-sm);
  margin-bottom: var(--theme-space-xs);
}

.discord-rules-card__select {
  padding: var(--theme-space-sm) var(--theme-space-md);
  border: 1px solid var(--theme-border, #ccc);
  border-radius: 4px;
  min-width: 200px;
}

.discord-rules-card__select--themed {
  color: var(--theme-text-primary, #111);
  background-color: var(--theme-bg-primary, #fff);
  border-color: var(--theme-border, #ccc);
}

.discord-rules-card__select--themed option {
  color: var(--theme-text-primary, #111);
  background-color: var(--theme-bg-primary, #fff);
}

.discord-rules-card__roles-hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted, #666);
  margin-top: var(--theme-space-xs);
  margin-bottom: 0;
}

.discord-rules-card__select--sm {
  min-width: 80px;
}

.discord-rules-card__condition-block {
  margin-bottom: var(--theme-space-md);
}

.discord-rules-card__condition-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-xs);
}

.discord-rules-card__mint-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--theme-space-sm);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted, #666);
  margin-left: 0;
  padding-left: 0;
}

.discord-rules-card__mint-preview-name {
  font-weight: 500;
}

.discord-rules-card__mint-preview-symbol {
  opacity: 0.9;
}

.discord-rules-card__mint-preview-meta,
.discord-rules-card__mint-preview-holders {
  margin-left: var(--theme-space-sm);
}

.discord-rules-card__btn-spin {
  animation: discord-rules-btn-spin 0.8s linear infinite;
}

@keyframes discord-rules-btn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.discord-rules-card__trait-hint {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted, #666);
  display: block;
  margin-top: var(--theme-space-xs);
}

.discord-rules-card__mint-input,
.discord-rules-card__threshold-input,
.discord-rules-card__trait-input {
  flex: 1;
  min-width: 120px;
}

.discord-rules-card__discord-roles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--theme-space-sm);
}

.discord-rules-card__select--multi {
  min-height: 80px;
  min-width: 180px;
}

.discord-rules-card__role-logic-label {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted, #666);
}

.discord-rules-card__form-actions {
  display: flex;
  gap: var(--theme-space-md);
  margin-top: var(--theme-space-md);
}
</style>
