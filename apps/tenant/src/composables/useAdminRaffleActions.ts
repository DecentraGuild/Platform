import type { Ref } from 'vue'
import { getEscrowWalletFromConnector, sendAndConfirmTransaction } from '@decentraguild/web3'
import type { Connection } from '@solana/web3.js'
import type { Transaction } from '@solana/web3.js'
import { useTransactionNotificationsStore } from '~/stores/transactionNotifications'

const TX_STATUS_LABELS: Record<string, string> = {
  signing: 'Signing...',
  sending: 'Sending...',
  confirming: 'Confirming...',
}

export interface AdminRaffleActionsOptions {
  connection: Ref<Connection | null>
  onSuccess?: () => Promise<void>
}

/**
 * Composable for admin raffle transaction handling: status feedback, error state, send + run actions.
 */
export function useAdminRaffleActions(options: AdminRaffleActionsOptions) {
  const { connection, onSuccess } = options

  const actionSubmitting = ref<string | null>(null)
  const actionTxStatus = ref<string | null>(null)
  const actionError = ref<string | null>(null)
  const actionErrorRaffle = ref<string | null>(null)
  const txNotifications = useTransactionNotificationsStore()

  function clearActionError(rafflePubkey?: string) {
    actionError.value = null
    if (!rafflePubkey || actionErrorRaffle.value === rafflePubkey) {
      actionErrorRaffle.value = null
    }
  }

  async function sendWithTxStatus(
    conn: Connection,
    tx: Transaction,
    wallet: { publicKey: import('@solana/web3.js').PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
    feePayer: import('@solana/web3.js').PublicKey
  ): Promise<string> {
    const notificationId = `raffle-${Date.now()}`
    txNotifications.add(notificationId, {
      status: 'pending',
      message: 'Raffle transaction. Confirm the transaction in your wallet.',
      signature: null,
    })

    try {
      const sig = await sendAndConfirmTransaction(conn, tx, wallet, feePayer, {
        onStatus: (s) => {
          const label = TX_STATUS_LABELS[s] ?? s
          actionTxStatus.value = label
          txNotifications.update(notificationId, {
            status: 'pending',
            message: `Raffle transaction: ${label}`,
          })
        },
      })

      txNotifications.update(notificationId, {
        status: 'success',
        message: 'Raffle transaction confirmed.',
        signature: sig,
      })

      return sig
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      txNotifications.update(notificationId, {
        status: 'error',
        message: msg,
        signature: null,
      })
      throw e
    }
  }

  async function runRaffleAction(
    rafflePubkey: string,
    fn: () => Promise<void>,
    errMsg: string,
    afterSuccess?: () => Promise<void>
  ): Promise<void> {
    if (!connection.value) return
    const wallet = getEscrowWalletFromConnector()
    if (!wallet?.publicKey) return

    actionSubmitting.value = rafflePubkey
    actionTxStatus.value = null
    clearActionError()
    try {
      await fn()
      clearActionError(rafflePubkey)
      await (afterSuccess ?? onSuccess)?.()
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : errMsg
      actionErrorRaffle.value = rafflePubkey
    } finally {
      actionSubmitting.value = null
      actionTxStatus.value = null
    }
  }

  return {
    actionSubmitting,
    actionTxStatus,
    actionError,
    actionErrorRaffle,
    clearActionError,
    sendWithTxStatus,
    runRaffleAction,
  }
}
