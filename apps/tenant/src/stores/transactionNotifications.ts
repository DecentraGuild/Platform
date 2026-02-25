import { defineStore } from 'pinia'
import { ref } from 'vue'

export type TransactionStatus = 'pending' | 'success' | 'error'

export interface TransactionNotification {
  id: string
  status: TransactionStatus
  message: string
  signature?: string | null
  createdAt: number
}

export const useTransactionNotificationsStore = defineStore('transactionNotifications', () => {
  const items = ref<TransactionNotification[]>([])

  const SUCCESS_AUTO_DISMISS_MS = 5000

  function add(id: string, data: { status: TransactionStatus; message: string; signature?: string | null }) {
    const exists = items.value.find((i) => i.id === id)
    if (exists) {
      exists.status = data.status
      exists.message = data.message
      exists.signature = data.signature ?? null
      if (data.status === 'success') {
        setTimeout(() => remove(id), SUCCESS_AUTO_DISMISS_MS)
      }
      return
    }
    items.value = [
      ...items.value,
      { id, status: data.status, message: data.message, signature: data.signature ?? null, createdAt: Date.now() },
    ].slice(-5)
    if (data.status === 'success') {
      setTimeout(() => remove(id), SUCCESS_AUTO_DISMISS_MS)
    }
  }

  function update(id: string, data: Partial<{ status: TransactionStatus; message: string; signature: string | null }>) {
    const item = items.value.find((i) => i.id === id)
    if (item) {
      if (data.status !== undefined) item.status = data.status
      if (data.message !== undefined) item.message = data.message
      if (data.signature !== undefined) item.signature = data.signature
      if (data.status === 'success') {
        setTimeout(() => remove(id), SUCCESS_AUTO_DISMISS_MS)
      }
    }
  }

  function remove(id: string) {
    items.value = items.value.filter((i) => i.id !== id)
  }

  return { items, add, update, remove }
})
