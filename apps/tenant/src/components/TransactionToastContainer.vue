<template>
  <div class="transaction-toast-container">
    <TransactionToast
      v-for="item in store.items"
      :key="item.id"
      :status="item.status"
      :message="item.message"
      :signature="item.signature"
      :explorer-url="item.signature ? store.getExplorerUrl(item.signature) : undefined"
      :dismissible="item.status !== 'pending'"
      @dismiss="store.remove(item.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { TransactionToast } from '@decentraguild/ui/components'
import { useTransactionNotificationsStore } from '~/stores/transactionNotifications'

const store = useTransactionNotificationsStore()
</script>

<style scoped>
.transaction-toast-container {
  position: fixed;
  bottom: var(--theme-space-lg);
  right: var(--theme-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-sm);
  z-index: 9999;
  max-width: 24rem;
}
</style>
