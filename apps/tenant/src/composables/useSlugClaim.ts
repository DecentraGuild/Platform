/**
 * Slug claim flow for id-only tenants: check availability, claim via billing, extend.
 */

import type { BillingPeriod } from '@decentraguild/billing'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  buildBillingTransfer,
  sendAndConfirmTransaction,
  getEscrowWalletFromConnector,
} from '@decentraguild/web3'
import { useTenantStore } from '~/stores/tenant'
import { useRpc } from '~/composables/useRpc'
import { API_V1 } from '~/utils/apiBase'
import type { Ref } from 'vue'

export function useSlugClaim(opts: {
  slug: Ref<string | null>
  saveError: Ref<string | null>
  saving: Ref<boolean>
  handleBillingPayment: (
    moduleId: string,
    period: BillingPeriod,
    slugToClaim?: string,
  ) => Promise<boolean>
  fetchSubscription: (moduleId: string) => Promise<void>
}) {
  const {
    slug,
    saveError,
    saving,
    handleBillingPayment,
    fetchSubscription,
  } = opts
  const tenantStore = useTenantStore()
  const apiBase = useApiBase()
  const { rpcUrl } = useRpc()

  const showSlugUnlock = ref(false)
  const desiredSlug = ref('')
  const slugCheckStatus = ref<'idle' | 'checking' | 'available' | 'taken'>(
    'idle',
  )
  const slugChecking = ref(false)
  const slugClaiming = ref(false)

  async function checkSlugAvailability() {
    const s = desiredSlug.value.trim().toLowerCase()
    if (!s || !slug.value) return
    slugChecking.value = true
    slugCheckStatus.value = 'checking'
    try {
      const res = await fetch(
        `${apiBase.value}${API_V1}/tenant/${slug.value}/slug/check?slug=${encodeURIComponent(s)}`,
        { credentials: 'include' },
      )
      const data = (await res.json().catch(() => ({}))) as { available?: boolean }
      slugCheckStatus.value = data.available ? 'available' : 'taken'
    } catch {
      slugCheckStatus.value = 'idle'
    } finally {
      slugChecking.value = false
    }
  }

  function onSlugCheckBlur() {
    if (desiredSlug.value.trim()) checkSlugAvailability()
  }

  async function claimSlug() {
    const s = desiredSlug.value.trim().toLowerCase()
    if (!s || slugCheckStatus.value !== 'available' || !slug.value) return
    slugClaiming.value = true
    saveError.value = null
    try {
      await handleBillingPayment('slug', 'yearly', s)
      tenantStore.refetchTenantContext()
      showSlugUnlock.value = false
      desiredSlug.value = ''
      slugCheckStatus.value = 'idle'
      await fetchSubscription('slug')
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : 'Claim failed'
    } finally {
      slugClaiming.value = false
    }
  }

  async function claimSlugWithPeriod(_period: BillingPeriod) {
    if (slugCheckStatus.value !== 'available') return
    await claimSlug()
  }

  async function extendSlug(period: BillingPeriod) {
    if (!slug.value) return
    saving.value = true
    saveError.value = null
    try {
      const base = apiBase.value
      const intentRes = await fetch(
        `${base}${API_V1}/tenant/${slug.value}/billing/extend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ moduleId: 'slug', billingPeriod: period }),
        },
      )
      if (!intentRes.ok) {
        const data = (await intentRes.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error ?? 'Failed to extend')
      }
      const intent = (await intentRes.json()) as {
        noPaymentRequired: boolean
        paymentId?: string
        amountUsdc?: number
        memo?: string
        recipientAta?: string
        tenant?: Record<string, unknown>
      }
      if (intent.noPaymentRequired) {
        await fetchSubscription('slug')
        return
      }
      if (
        !intent.paymentId ||
        !intent.amountUsdc ||
        !intent.memo ||
        !intent.recipientAta
      ) {
        throw new Error('Invalid extension intent response')
      }
      if (!rpcUrl.value) throw new Error('Solana RPC not configured')
      const wallet = getEscrowWalletFromConnector()
      if (!wallet?.publicKey) throw new Error('Wallet not connected')

      const connection = new Connection(rpcUrl.value)
      const tx = buildBillingTransfer({
        payer: wallet.publicKey,
        amountUsdc: intent.amountUsdc,
        recipientAta: new PublicKey(intent.recipientAta),
        memo: intent.memo,
        connection,
      })
      const txSignature = await sendAndConfirmTransaction(
        connection,
        tx,
        wallet,
        wallet.publicKey,
      )

      const confirmRes = await fetch(
        `${base}${API_V1}/tenant/${slug.value}/billing/confirm-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            paymentId: intent.paymentId,
            txSignature,
          }),
        },
      )
      if (!confirmRes.ok) {
        const data = (await confirmRes.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error ?? 'Extension confirmation failed')
      }
      const confirmData = (await confirmRes.json()) as {
        tenant?: Record<string, unknown>
      }
      if (confirmData.tenant) {
        tenantStore.setTenant(confirmData.tenant)
      }
      await fetchSubscription('slug')
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : 'Extend failed'
    } finally {
      saving.value = false
    }
  }

  return {
    showSlugUnlock,
    desiredSlug,
    slugCheckStatus,
    slugChecking,
    slugClaiming,
    checkSlugAvailability,
    onSlugCheckBlur,
    claimSlug,
    claimSlugWithPeriod,
    extendSlug,
  }
}
