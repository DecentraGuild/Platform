/**
 * Admin billing: payment flow, deploy, reactivate, extend for modules.
 * Uses Solana wallet for USDC transfer; updates tenant after confirm.
 */

import type { ModuleState } from '@decentraguild/core'
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

interface PaymentIntentResponse {
  noPaymentRequired: boolean
  paymentId?: string
  amountUsdc?: number
  memo?: string
  recipientWallet?: string
  recipientAta?: string
  billingPeriod?: string
  periodStart?: string
  periodEnd?: string
  error?: string
}

export function useAdminBilling(opts: {
  saveError: Ref<string | null>
  saving: Ref<boolean>
  deploying: Ref<boolean>
  extending: Ref<boolean>
  fetchSubscription: (moduleId: string) => Promise<void>
}) {
  const { saveError, saving, deploying, extending, fetchSubscription } = opts
  const tenantStore = useTenantStore()
  const apiBase = useApiBase()
  const { rpcUrl } = useRpc()
  const slug = computed(() => tenantStore.slug)

  async function handleBillingPayment(
    moduleId: string,
    billingPeriod: BillingPeriod,
    slugToClaim?: string,
  ): Promise<boolean> {
    const s = slug.value
    if (!s) return false
    const base = apiBase.value

    const body: Record<string, unknown> = { moduleId, billingPeriod }
    if (moduleId === 'slug' && slugToClaim) body.slug = slugToClaim

    const intentRes = await fetch(`${base}${API_V1}/tenant/${s}/billing/payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    if (!intentRes.ok) {
      const data = (await intentRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Failed to create payment intent')
    }

    const intent: PaymentIntentResponse = await intentRes.json()

    if (intent.noPaymentRequired) return true

    if (
      !intent.paymentId ||
      !intent.amountUsdc ||
      !intent.memo ||
      !intent.recipientAta
    ) {
      throw new Error('Invalid payment intent response')
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

    const confirmRes = await fetch(`${base}${API_V1}/tenant/${s}/billing/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paymentId: intent.paymentId, txSignature }),
    })

    if (!confirmRes.ok) {
      const data = (await confirmRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(data.error ?? 'Payment confirmation failed')
    }

    const confirmData = (await confirmRes.json()) as {
      tenant?: Record<string, unknown>
    }
    if (confirmData.tenant) {
      tenantStore.setTenant(confirmData.tenant)
    }

    return true
  }

  async function deployModule(
    moduleId: string,
    billingPeriod: BillingPeriod,
  ) {
    if (!slug.value) return
    deploying.value = true
    saveError.value = null
    try {
      const paid = await handleBillingPayment(moduleId, billingPeriod)
      if (!paid) throw new Error('Payment was not completed')

      const freshTenant = tenantStore.tenant
      const moduleEntry = freshTenant?.modules?.[moduleId] as
        | { state?: string }
        | undefined
      if (moduleEntry?.state === 'active') return

      const prevMods = freshTenant?.modules ?? {}
      const modules = { ...prevMods }
      const prev = (modules[moduleId] ?? {}) as {
        state?: ModuleState
        deactivatedate?: string | null
        deactivatingUntil?: string | null
        settingsjson?: Record<string, unknown>
      }
      modules[moduleId] = {
        state: 'active',
        deactivatedate: prev.deactivatedate ?? null,
        deactivatingUntil: prev.deactivatingUntil ?? null,
        settingsjson: prev.settingsjson ?? {},
      }
      const res = await fetch(
        `${apiBase.value}${API_V1}/tenant/${slug.value}/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ modules }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Deploy failed')
      }
      const data = (await res.json()) as { tenant: Record<string, unknown> }
      tenantStore.setTenant(data.tenant)
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : 'Deploy failed'
    } finally {
      deploying.value = false
    }
  }

  async function reactivateModule(
    moduleId: string,
    billingPeriod: BillingPeriod,
  ) {
    if (!slug.value) return
    saving.value = true
    saveError.value = null
    try {
      const paid = await handleBillingPayment(moduleId, billingPeriod)
      if (!paid) throw new Error('Payment was not completed')

      const freshTenant = tenantStore.tenant
      const moduleEntry = freshTenant?.modules?.[moduleId] as
        | { state?: string }
        | undefined
      if (moduleEntry?.state === 'active') return

      const prevMods = freshTenant?.modules ?? {}
      const modules = { ...prevMods }
      const prev = (modules[moduleId] ?? {}) as {
        deactivatedate?: string | null
        deactivatingUntil?: string | null
        settingsjson?: Record<string, unknown>
      }
      modules[moduleId] = {
        state: 'active',
        deactivatedate: null,
        deactivatingUntil: null,
        settingsjson: prev.settingsjson ?? {},
      }
      const res = await fetch(
        `${apiBase.value}${API_V1}/tenant/${slug.value}/settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ modules }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Reactivate failed')
      }
      const data = (await res.json()) as { tenant: Record<string, unknown> }
      tenantStore.setTenant(data.tenant)
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : 'Reactivate failed'
    } finally {
      saving.value = false
    }
  }

  async function extendModule(
    moduleId: string,
    billingPeriod: BillingPeriod,
  ) {
    if (!slug.value) return
    extending.value = true
    saveError.value = null
    try {
      const base = apiBase.value
      const intentRes = await fetch(
        `${base}${API_V1}/tenant/${slug.value}/billing/extend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ moduleId, billingPeriod }),
        },
      )
      if (!intentRes.ok) {
        const data = (await intentRes.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error ?? 'Failed to extend')
      }
      const intent = (await intentRes.json()) as PaymentIntentResponse
      if (intent.noPaymentRequired) {
        await fetchSubscription(moduleId)
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
          body: JSON.stringify({ paymentId: intent.paymentId, txSignature }),
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
      await fetchSubscription(moduleId)
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : 'Extend failed'
    } finally {
      extending.value = false
    }
  }

  return {
    handleBillingPayment,
    deployModule,
    reactivateModule,
    extendModule,
    slug,
  }
}
