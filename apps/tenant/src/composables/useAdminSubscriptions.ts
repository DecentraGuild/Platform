/**
 * Admin billing subscriptions per module. Fetched when switching to relevant tabs.
 */

import type { BillingPeriod } from '@decentraguild/billing'
import { useTenantStore } from '~/stores/tenant'
import { API_V1 } from '~/utils/apiBase'

export interface SubscriptionInfo {
  billingPeriod: BillingPeriod
  periodEnd: string
  recurringAmountUsdc: number
}

export function useAdminSubscriptions() {
  const tenantStore = useTenantStore()
  const apiBase = useApiBase()
  const slug = computed(() => tenantStore.slug)

  const subscriptions = reactive<Record<string, SubscriptionInfo | null>>({})

  async function fetchSubscription(moduleId: string) {
    if (!slug.value) return
    try {
      const res = await fetch(
        `${apiBase.value}${API_V1}/tenant/${slug.value}/billing/subscription/${moduleId}`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const data = (await res.json()) as { subscription: SubscriptionInfo | null }
        subscriptions[moduleId] = data.subscription
      }
    } catch {
      // silent
    }
  }

  return { subscriptions, fetchSubscription, slug }
}
