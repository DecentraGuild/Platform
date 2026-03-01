<template>
  <div class="admin__split">
    <div class="admin__panel">
    <Card>
      <h3>Billing History</h3>
      <div v-if="loading" class="admin__billing-loading">
        <Icon icon="mdi:loading" class="admin__spinner" />
        <span>Loading payments...</span>
      </div>
      <div v-else-if="payments.length === 0" class="admin__billing-empty">
        No payments recorded yet.
      </div>
      <table v-else class="admin__billing-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Module</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Period</th>
            <th>End date</th>
            <th>Tx</th>
            <th>Invoice</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in payments" :key="p.id">
            <td>{{ formatPaymentDate(p.confirmedAt) }}</td>
            <td>{{ MODULE_NAV[p.moduleId]?.label ?? p.moduleId }}</td>
            <td>{{ formatPaymentType(p) }}</td>
            <td class="admin__billing-amount">{{ formatUsdc(p.amountUsdc) }} USDC</td>
            <td>{{ p.billingPeriod }}</td>
            <td>{{ formatPaymentDate(p.periodEnd) }}</td>
            <td>
              <a
                v-if="p.txSignature"
                :href="`https://solscan.io/tx/${p.txSignature}`"
                target="_blank"
                rel="noopener"
                class="admin__billing-tx-link"
              >
                <Icon icon="mdi:open-in-new" />
              </a>
            </td>
            <td>
              <button class="admin__billing-invoice-btn" @click="downloadInvoice(p.id)">
                <Icon icon="mdi:file-download-outline" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>
    </div>
    <div aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import { Card } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import { MODULE_NAV } from '~/config/modules'
import { API_V1 } from '~/utils/apiBase'

const props = defineProps<{
  slug: string | null
}>()

const payments = ref<BillingPaymentRecord[]>([])
const loading = ref(false)

interface BillingPaymentRecord {
  id: string
  moduleId: string
  paymentType: string
  amountUsdc: number
  billingPeriod: string
  periodEnd: string | null
  txSignature: string | null
  confirmedAt: string | null
  priceSnapshot: {
    previousTierName?: string
    newTierName?: string
    remainingDays?: number
  } | null
}

const apiBase = useApiBase()

async function load() {
  if (!props.slug) return
  loading.value = true
  try {
    const res = await fetch(
      `${apiBase.value}${API_V1}/tenant/${props.slug}/billing/payments`,
      { credentials: 'include' },
    )
    if (res.ok) {
      const data = (await res.json()) as { payments: BillingPaymentRecord[] }
      payments.value = data.payments
    }
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

watch(() => props.slug, (s) => {
  if (s) load()
}, { immediate: true })

function formatPaymentDate(iso: string | null): string {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

function formatPaymentType(p: BillingPaymentRecord): string {
  if (p.paymentType === 'upgrade_prorate' && p.priceSnapshot) {
    const prev = p.priceSnapshot.previousTierName
    const next = p.priceSnapshot.newTierName
    const days = p.priceSnapshot.remainingDays
    if (prev && next) {
      return `Upgrade (${prev} to ${next}${days ? `, ${days}d remaining` : ''})`
    }
  }
  const labels: Record<string, string> = {
    initial: 'Initial',
    upgrade_prorate: 'Upgrade',
    renewal: 'Renewal',
    extend: 'Extension',
  }
  return labels[p.paymentType] ?? p.paymentType
}

function formatUsdc(value: number): string {
  return parseFloat(value.toFixed(6)).toString()
}

async function downloadInvoice(paymentId: string) {
  if (!props.slug) return
  try {
    const res = await fetch(
      `${apiBase.value}${API_V1}/tenant/${props.slug}/billing/payments/${paymentId}/invoice`,
      { credentials: 'include' },
    )
    if (!res.ok) return
    const data = (await res.json()) as { invoice: Record<string, unknown> }
    const blob = new Blob([JSON.stringify(data.invoice, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${paymentId}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // silent
  }
}

defineExpose({ load })
</script>

<style scoped>
.admin__billing-loading {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  color: var(--theme-text-muted);
  font-size: var(--theme-font-sm);
}

.admin__spinner {
  animation: admin-spin 1s linear infinite;
}

@keyframes admin-spin {
  to { transform: rotate(360deg); }
}

.admin__billing-empty {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
}

.admin__billing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--theme-font-sm);
}

.admin__billing-table th {
  text-align: left;
  font-weight: 600;
  color: var(--theme-text-secondary);
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
  white-space: nowrap;
}

.admin__billing-table td {
  padding: var(--theme-space-xs) var(--theme-space-sm);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
  color: var(--theme-text-primary);
  white-space: nowrap;
}

.admin__billing-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.admin__billing-tx-link {
  color: var(--theme-primary);
  display: inline-flex;
  align-items: center;
}

.admin__billing-invoice-btn {
  background: none;
  border: none;
  color: var(--theme-primary);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  font-size: var(--theme-font-md);
}

.admin__billing-invoice-btn:hover {
  color: var(--theme-text-primary);
}
</style>
