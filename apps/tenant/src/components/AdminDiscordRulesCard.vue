<template>
  <Card class="discord-rules-card">
    <h3>Role rules</h3>
    <p class="discord-rules-card__hint">
      Assign a Discord role when members meet conditions (SPL balance, NFT collection, trait, or Discord role). Choose mints from the catalog above; for Trait conditions, select a collection and trait key/value dropdowns will load. After each condition choose AND or OR before the next. Max 5 conditions per rule.
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
                <option value="">Type</option>
                <option v-for="t in conditionTypes" :key="t.id" :value="t.id">{{ t.label }}</option>
              </select>
              <template v-if="typeNeedsMint(cond.type)">
                <template v-if="cond.type === 'SPL'">
                  <select
                    v-model="cond.mint_or_group"
                    class="discord-rules-card__select discord-rules-card__select--themed discord-rules-card__select--mint"
                  >
                    <option value="">Mint / collection</option>
                    <option
                      v-for="mint in splMints"
                      :key="mint.asset_id"
                      :value="mint.asset_id"
                    >
                      {{ mint.label }}{{ mint.symbol ? ` (${mint.symbol})` : '' }}
                    </option>
                  </select>
                  <TextInput
                    v-model="cond.threshold"
                    type="number"
                    placeholder="Amount"
                    class="discord-rules-card__amount-input"
                  />
                </template>
                <template v-else>
                  <select
                    v-model="cond.mint_or_group"
                    class="discord-rules-card__select discord-rules-card__select--themed discord-rules-card__select--mint"
                    @change="clearTraitWhenCollectionChanges(cond)"
                  >
                    <option value="">Mint / collection</option>
                    <option
                      v-for="mint in nftMints"
                      :key="mint.asset_id"
                      :value="mint.asset_id"
                    >
                      {{ mint.label }}{{ mint.symbol ? ` (${mint.symbol})` : '' }}
                    </option>
                  </select>
                  <TextInput
                    v-model="cond.amount"
                    type="number"
                    placeholder="Amount"
                    class="discord-rules-card__amount-input"
                  />
                  <template v-if="cond.type === 'TRAIT'">
                    <template v-if="traitOptionsForCondition(idx).trait_keys.length">
                      <select
                        v-model="cond.trait_key"
                        class="discord-rules-card__select discord-rules-card__select--sm discord-rules-card__select--themed"
                        aria-label="Trait key"
                        @change="cond.trait_value = ''"
                      >
                        <option value="">Trait key</option>
                        <option
                          v-for="key in traitOptionsForCondition(idx).trait_keys"
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
                        <option value="">Trait value</option>
                        <option
                          v-for="val in traitValueOptionsForCondition(idx)"
                          :key="val"
                          :value="val"
                        >
                          {{ val }}
                        </option>
                      </select>
                    </template>
                    <template v-else>
                      <TextInput
                        v-model="cond.trait_key"
                        placeholder="Trait key"
                        class="discord-rules-card__trait-input"
                      />
                      <TextInput
                        v-model="cond.trait_value"
                        placeholder="Trait value"
                        class="discord-rules-card__trait-input"
                      />
                      <span class="discord-rules-card__trait-hint">
                        {{ cond.mint_or_group ? 'Traits are stored when the collection is added to the mint catalog. Re-add the collection to refresh trait options.' : 'Select an NFT collection from the catalog above.' }}
                      </span>
                    </template>
                  </template>
                </template>
              </template>
              <template v-else-if="cond.type === 'DISCORD'">
                <select
                  v-model="cond.required_role_id"
                  class="discord-rules-card__select discord-rules-card__select--themed"
                  aria-label="Required Discord role"
                >
                  <option value="">Discord role</option>
                  <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
              </template>
              <select
                v-model="cond.logic_to_next"
                class="discord-rules-card__select discord-rules-card__select--sm discord-rules-card__select--themed"
                aria-label="Logic to next condition"
                @change="onLogicChange(idx)"
              >
                <option v-if="idx === form.conditions.length - 1" value=""></option>
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
              <Button variant="ghost" size="small" @click="removeCondition(idx)">
                <Icon icon="mdi:close" />
              </Button>
            </div>
          </div>
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
import { API_V1 } from '~/utils/apiBase'
import { Card, TextInput, Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'

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

const props = defineProps<{
  slug: string
  catalogMints: CatalogMint[]
}>()
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
  required_role_id?: string
  logic_to_next?: 'AND' | 'OR' | null
  amount?: number | null
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
    required_role_id?: string
    logic_to_next?: 'AND' | 'OR'
    amount?: string
  }>,
})

function typeNeedsMint(type: string): boolean {
  return type === 'SPL' || type === 'NFT' || type === 'TRAIT'
}
function onConditionTypeChange(cond: (typeof form.conditions)[number]) {
  if (cond.type === 'DISCORD' && typeof cond.required_role_id !== 'string') {
    cond.required_role_id = ''
  }
}
function isConditionFilled(c: (typeof form.conditions)[number]): boolean {
  if (typeNeedsMint(c.type)) return !!c.mint_or_group?.trim()
  if (c.type === 'DISCORD') return !!c.required_role_id?.trim()
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

const splMints = computed(() => props.catalogMints.filter((m) => m.kind === 'SPL'))
const nftMints = computed(() => props.catalogMints.filter((m) => m.kind === 'NFT'))

function traitOptionsForCondition(idx: number): { trait_keys: string[]; trait_options: Record<string, string[]> } {
  const cond = form.conditions[idx]
  const asset = cond?.mint_or_group?.trim()
  if (!asset) return { trait_keys: [], trait_options: {} }
  const catalogMint = props.catalogMints.find((m) => m.asset_id === asset)
  return {
    trait_keys: catalogMint?.trait_keys ?? [],
    trait_options: catalogMint?.trait_options ?? {},
  }
}

function traitValueOptionsForCondition(idx: number): string[] {
  const cond = form.conditions[idx]
  const key = cond?.trait_key?.trim()
  if (!key) return []
  const { trait_options } = traitOptionsForCondition(idx)
  return trait_options[key] ?? []
}

function clearTraitWhenCollectionChanges(cond: (typeof form.conditions)[number]) {
  if (cond.type === 'TRAIT') {
    cond.trait_key = ''
    cond.trait_value = ''
  }
}

function onLogicChange(idx: number) {
  const cond = form.conditions[idx]
  if (!cond) return
  const isLast = idx === form.conditions.length - 1
  if (!isLast) return
  if (cond.logic_to_next === 'AND' || cond.logic_to_next === 'OR') {
    addCondition()
  }
}

function addCondition() {
  if (form.conditions.length >= 5) return
  const last = form.conditions[form.conditions.length - 1]
  if (last) {
    last.logic_to_next = last.logic_to_next === 'OR' ? 'OR' : 'AND'
  }
  const defaultType = conditionTypes.value[0]?.id ?? 'SPL'
  form.conditions.push({
    type: defaultType,
    mint_or_group: '',
    logic_to_next: null,
    amount: defaultType === 'NFT' || defaultType === 'TRAIT' ? '1' : undefined,
    ...(defaultType === 'DISCORD' ? { required_role_id: '' } : {}),
  })
}
function removeCondition(idx: number) {
  form.conditions.splice(idx, 1)
  if (idx > 0 && form.conditions[idx - 1]) form.conditions[idx - 1]!.logic_to_next = 'AND'
  if (form.conditions.length === 1) form.conditions[0]!.logic_to_next = null
}
function resetForm() {
  form.discord_role_id = ''
  form.operator = 'AND'
  const defaultType = conditionTypes.value[0]?.id ?? 'SPL'
  form.conditions = [{
    type: defaultType,
    mint_or_group: '',
    logic_to_next: null,
    amount: defaultType === 'NFT' || defaultType === 'TRAIT' ? '1' : undefined,
    ...(defaultType === 'DISCORD' ? { required_role_id: '' } : {}),
  }]
  editingRuleId.value = null
}
function roleName(roleId: string): string {
  return roles.value.find((r) => r.id === roleId)?.name ?? roleId
}
function conditionSummary(c: RuleCondition, nextLogic?: string | null): string {
  if (c.type === 'DISCORD') {
    const name = c.required_role_id ? roleName(c.required_role_id) : '(no role)'
    const base = `DISCORD ${name}`
    return nextLogic ? `${base} ${nextLogic}` : base
  }
  const mintLabel =
    props.catalogMints.find((m) => m.asset_id === c.mint_or_group)?.label ?? c.mint_or_group
  const parts = [c.type, mintLabel]
  if (c.type === 'SPL' && c.threshold != null) parts.push(`>= ${c.threshold}`)
  if ((c.type === 'NFT' || c.type === 'TRAIT') && c.amount != null && c.amount > 1) {
    parts.push(`x ${c.amount}`)
  }
  if (c.type === 'TRAIT' && c.trait_key) parts.push(`${c.trait_key}=${c.trait_value ?? ''}`)
  const base = parts.join(' ')
  return nextLogic ? `${base} ${nextLogic}` : base
}

async function fetchRules() {
  rulesLoading.value = true
  rulesError.value = null
  try {
    const [typesRes, rolesRes, rulesRes] = await Promise.all([
      fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/condition-types`, { credentials: 'include' }),
      fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/roles`, { credentials: 'include' }),
      fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/rules`, { credentials: 'include' }),
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
        required_role_id: c.required_role_id ?? '',
        logic_to_next: c.logic_to_next ?? (i < rule.conditions.length - 1 ? 'AND' : undefined),
        amount: c.amount != null ? String(c.amount) : c.type === 'NFT' || c.type === 'TRAIT' ? '1' : undefined,
      }))
    : [{
      type: defaultType,
      mint_or_group: '',
      logic_to_next: null,
      amount: defaultType === 'NFT' || defaultType === 'TRAIT' ? '1' : undefined,
      ...(defaultType === 'DISCORD' ? { required_role_id: '' } : {}),
    }]
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
        return { ...base, required_role_id: (c.required_role_id ?? '').trim() }
      }
      return {
        ...base,
        mint_or_group: c.mint_or_group.trim(),
        threshold: c.type === 'SPL' && c.threshold !== '' ? Number(c.threshold) : undefined,
        trait_key: c.trait_key?.trim() || undefined,
        trait_value: c.trait_value?.trim() || undefined,
        amount:
          (c.type === 'NFT' || c.type === 'TRAIT') && c.amount && c.amount !== ''
            ? Number(c.amount)
            : undefined,
      }
    })
    if (editingRuleId.value != null) {
      const res = await fetch(
        `${apiBase.value}${API_V1}/tenant/${props.slug}/discord/rules/${editingRuleId.value}`,
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
      const res = await fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/rules`, {
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
  const res = await fetch(`${apiBase.value}${API_V1}/tenant/${props.slug}/discord/rules/${id}`, {
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
  flex: none;
  width: 7.5rem;
  min-width: 5.5rem;
}

.discord-rules-card__select--mint {
  flex: 1;
  min-width: 0;
  max-width: none;
}

.discord-rules-card__amount-input {
  flex: none;
  width: 7.5rem;
  min-width: 5.5rem;
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
.discord-rules-card__trait-input {
  flex: 1;
  min-width: 120px;
}

.discord-rules-card__form-actions {
  display: flex;
  gap: var(--theme-space-md);
  margin-top: var(--theme-space-md);
}
</style>
