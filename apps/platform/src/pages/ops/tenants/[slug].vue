<template>
  <PageSection>
    <div class="ops-tenant">
      <header class="ops-tenant__header">
        <div>
          <button type="button" class="ops-tenant__back" @click="back">
            ← Back to overview
          </button>
          <h1 class="ops-tenant__title">
            {{ tenant?.name ?? 'Tenant' }}
          </h1>
          <p class="ops-tenant__subtitle">
            {{ tenantIdentifier }}
          </p>
        </div>
        <div class="ops-tenant__meta">
          <div class="ops-tenant__meta-item">
            <span class="ops-tenant__meta-label">Active modules</span>
            <span class="ops-tenant__meta-value">{{ stats?.activeModules ?? 0 }}</span>
          </div>
          <div class="ops-tenant__meta-item">
            <span class="ops-tenant__meta-label">Payments</span>
            <span class="ops-tenant__meta-value">{{ stats?.totalPayments ?? 0 }}</span>
          </div>
        </div>
      </header>

      <div v-if="loading" class="ops-tenant__body">Loading tenant…</div>
      <div v-else-if="error" class="ops-tenant__body ops-tenant__body--error">
        {{ error }}
      </div>
      <div v-else-if="tenant" class="ops-tenant__body ops-tenant__grid">
        <section class="ops-tenant__panel" aria-label="Config">
          <h2 class="ops-tenant__panel-title">Config</h2>
          <dl class="ops-tenant__config">
            <div>
              <dt>ID</dt>
              <dd><code>{{ tenant.id }}</code></dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>
                <span v-if="tenant.slug"><code>{{ tenant.slug }}</code></span>
                <span v-else class="ops-tenant__muted">none</span>
              </dd>
            </div>
            <div>
              <dt>Treasury</dt>
              <dd>
                <span v-if="tenant.treasury"><code>{{ tenant.treasury }}</code></span>
                <span v-else class="ops-tenant__muted">none</span>
              </dd>
            </div>
            <div>
              <dt>Admins</dt>
              <dd>
                <ul class="ops-tenant__list">
                  <li v-for="a in tenant.admins" :key="a"><code>{{ a }}</code></li>
                  <li v-if="!tenant.admins?.length" class="ops-tenant__muted">none</li>
                </ul>
              </dd>
            </div>
          </dl>
        </section>

        <section class="ops-tenant__panel" aria-label="Modules">
          <h2 class="ops-tenant__panel-title">Modules</h2>
          <table class="ops-tenant__table">
            <thead>
              <tr>
                <th>Module</th>
                <th>State</th>
                <th>Subscription</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in moduleRows" :key="entry.id">
                <td>{{ entry.id }}</td>
                <td>{{ entry.state }}</td>
                <td>
                  <span v-if="entry.subscription">
                    {{ entry.subscription.billingPeriod }} until
                    {{ formatDate(entry.subscription.periodEnd) }}
                  </span>
                  <span v-else class="ops-tenant__muted">none</span>
                </td>
                <td>
                  <Button
                    size="xs"
                    variant="ghost"
                    :disabled="toggleLoading === entry.id"
                    @click="toggleModule(entry.id, entry.state !== 'active')"
                  >
                    {{ entry.state === 'active' ? 'Disable' : 'Enable' }}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="moduleError" class="ops-tenant__error">
            {{ moduleError }}
          </p>
        </section>

        <section class="ops-tenant__panel ops-tenant__panel--full" aria-label="Billing">
          <h2 class="ops-tenant__panel-title">Billing</h2>
          <div class="ops-tenant__billing-grid">
            <div>
              <h3 class="ops-tenant__section-subtitle">Subscriptions</h3>
              <table class="ops-tenant__table ops-tenant__table--compact">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Billing</th>
                    <th>Period end</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in moduleRows" :key="entry.id">
                    <td>{{ entry.id }}</td>
                    <td>
                      <span v-if="entry.subscription">
                        {{ entry.subscription.billingPeriod }}
                      </span>
                      <span v-else class="ops-tenant__muted">none</span>
                    </td>
                    <td>
                      <span v-if="entry.subscription">
                        {{ formatDate(entry.subscription.periodEnd) }}
                      </span>
                      <span v-else class="ops-tenant__muted">n/a</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 class="ops-tenant__section-subtitle">Payments</h3>
              <table class="ops-tenant__table ops-tenant__table--compact">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Confirmed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in payments" :key="p.id">
                    <td>{{ p.moduleId }}</td>
                    <td>{{ formatUsdc(p.amountUsdc) }} USDC</td>
                    <td>{{ p.status }}</td>
                    <td>
                      <span v-if="p.confirmedAt">{{ formatDateTime(p.confirmedAt) }}</span>
                      <span v-else class="ops-tenant__muted">n/a</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
definePageMeta({ title: 'Tenant detail' })

import type { TenantConfig } from '@decentraguild/core'
import { getModuleCatalogList } from '@decentraguild/config'
import { PageSection, Button } from '@decentraguild/ui/components'
import { useApiBase } from '~/composables/useApiBase'

interface SubscriptionSummary {
  billingPeriod: string
  periodStart: string
  periodEnd: string
  recurringAmountUsdc: number
}

interface BillingPayment {
  id: string
  tenantSlug: string
  moduleId: string
  amountUsdc: number
  billingPeriod: string
  periodStart: string
  periodEnd: string
  status: string
  confirmedAt: string | null
}

interface TenantStats {
  activeModules: number
  totalPayments: number
  lastPaymentAt: string | null
}

interface TenantDetailResponse {
  tenant: TenantConfig
  billing: {
    subscriptions: Record<string, SubscriptionSummary | null>
    payments: BillingPayment[]
  }
  stats: TenantStats
}

const route = useRoute()
const router = useRouter()
const apiBase = useApiBase()

const tenant = ref<TenantConfig | null>(null)
const catalogModules = getModuleCatalogList()
const stats = ref<TenantStats | null>(null)
const subscriptions = ref<Record<string, SubscriptionSummary | null>>({})
const payments = ref<BillingPayment[]>([])

const loading = ref(true)
const error = ref<string | null>(null)
const moduleError = ref<string | null>(null)
const toggleLoading = ref<string | null>(null)

const tenantIdentifier = computed(() => {
  if (!tenant.value) return ''
  return tenant.value.slug ?? tenant.value.id
})

const moduleRows = computed(() =>
  catalogModules.map((entry) => {
    const id = entry.id
    const tenantEntry = (tenant.value?.modules ?? {})[id] as { state?: string } | undefined
    const state = ((tenantEntry?.state ?? 'off') as string) || 'off'
    const sub = subscriptions.value[id] ?? null
    return {
      id,
      state,
      subscription: sub,
    }
  }),
)

onMounted(async () => {
  await loadTenant()
})

async function loadTenant() {
  loading.value = true
  error.value = null
  try {
    const slug = route.params.slug as string
    const res = await fetch(`${apiBase.value}/api/v1/platform/tenants/${encodeURIComponent(slug)}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Failed to load tenant')
    }
    const data = (await res.json()) as TenantDetailResponse
    tenant.value = data.tenant
    stats.value = data.stats
    subscriptions.value = data.billing.subscriptions ?? {}
    payments.value = data.billing.payments ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load tenant'
  } finally {
    loading.value = false
  }
}

async function toggleModule(moduleId: string, enabled: boolean) {
  if (!tenant.value) return
  moduleError.value = null
  toggleLoading.value = moduleId
  try {
    const slugOrId = tenant.value.slug ?? tenant.value.id
    const res = await fetch(
      `${apiBase.value}/api/v1/platform/tenants/${encodeURIComponent(slugOrId)}/modules`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moduleId, enabled }),
      },
    )
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Failed to update module state')
    }
    const data = (await res.json()) as { tenant: TenantConfig }
    tenant.value = data.tenant
  } catch (e) {
    moduleError.value = e instanceof Error ? e.message : 'Failed to update module'
  } finally {
    toggleLoading.value = null
  }
}

function back() {
  if (history.length > 1) {
    router.back()
  } else {
    router.push('/ops')
  }
}

function formatDate(value: string | Date | null): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

function formatDateTime(value: string | Date | null): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function formatUsdc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<style scoped>
.ops-tenant {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-lg);
}

.ops-tenant__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--theme-space-lg);
}

.ops-tenant__back {
  border: none;
  padding: 0;
  background: none;
  color: var(--theme-text-secondary);
  font-size: var(--theme-font-xs);
  cursor: pointer;
  margin-bottom: var(--theme-space-xs);
}

.ops-tenant__title {
  margin: 0;
  font-size: var(--theme-font-xl);
  font-weight: 600;
}

.ops-tenant__subtitle {
  margin: 0;
  color: var(--theme-text-secondary);
}

.ops-tenant__meta {
  display: flex;
  gap: var(--theme-space-lg);
}

.ops-tenant__meta-item {
  min-width: 120px;
}

.ops-tenant__meta-label {
  display: block;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.ops-tenant__meta-value {
  font-size: var(--theme-font-lg);
  font-weight: 600;
}

.ops-tenant__body {
  background: var(--theme-bg-card);
  border-radius: var(--theme-radius-lg);
  border: 1px solid var(--theme-border);
  padding: var(--theme-space-lg);
}

.ops-tenant__body--error {
  color: var(--theme-error);
}

.ops-tenant__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr);
  grid-auto-rows: minmax(0, auto);
  gap: var(--theme-space-md);
  background: none;
  border: none;
  padding: 0;
}

.ops-tenant__panel {
  background: var(--theme-bg-card);
  border-radius: var(--theme-radius-lg);
  border: 1px solid var(--theme-border);
  padding: var(--theme-space-md) var(--theme-space-lg) var(--theme-space-lg);
}

.ops-tenant__panel--full {
  grid-column: 1 / -1;
}

.ops-tenant__panel-title {
  margin: 0 0 var(--theme-space-sm);
  font-size: var(--theme-font-md);
  font-weight: 600;
}

.ops-tenant__config {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--theme-space-md);
}

.ops-tenant__config dt {
  font-size: var(--theme-font-xs);
  color: var(--theme-text-muted);
}

.ops-tenant__config dd {
  margin: 0;
}

.ops-tenant__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ops-tenant__muted {
  color: var(--theme-text-muted);
}

.ops-tenant__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--theme-font-xs);
}

.ops-tenant__table th,
.ops-tenant__table td {
  padding: 0.35rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--theme-border-subtle);
}

.ops-tenant__table th {
  font-weight: 500;
  color: var(--theme-text-secondary);
}

.ops-tenant__table--compact th,
.ops-tenant__table--compact td {
  padding: 0.25rem 0.4rem;
}

.ops-tenant__billing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--theme-space-md);
}

.ops-tenant__section-subtitle {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-sm);
  font-weight: 500;
}

.ops-tenant__error {
  margin-top: var(--theme-space-sm);
  font-size: var(--theme-font-xs);
  color: var(--theme-error);
}

@media (max-width: var(--theme-breakpoint-md)) {
  .ops-tenant__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ops-tenant__meta {
    flex-direction: column;
  }
}
</style>

