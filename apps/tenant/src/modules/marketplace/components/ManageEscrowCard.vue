<template>
  <div class="manage-escrow-card">
    <div class="manage-escrow-card__body">
      <div class="manage-escrow-card__summary">
        <template v-if="display">
          <TokenAmountWithLabel
            :amount="display.depositAmount"
            :decimals="display.depositDecimals"
            :symbol="display.depositSymbol"
            :name="display.depositName"
            :mint="escrow.account.depositToken.toBase58()"
            :show-mint-short="true"
          />
          <span class="manage-escrow-card__at">at</span>
          <TokenAmountWithLabel
            :amount="escrow.account.price ?? 0"
            :decimals="0"
            :symbol="display.priceSymbol"
            :name="display.requestName"
            :mint="escrow.account.requestToken.toBase58()"
            :show-mint-short="true"
          />
          <span class="manage-escrow-card__per">per unit</span>
        </template>
        <span v-else class="manage-escrow-card__loading">Loading...</span>
      </div>
      <div class="manage-escrow-card__actions">
        <NuxtLink :to="escrowLink" class="manage-escrow-card__link">
          <Button variant="ghost">Details</Button>
        </NuxtLink>
        <Button
          v-if="showQuickCancel"
          variant="ghost"
          :disabled="cancelling"
          @click.stop="$emit('cancel')"
        >
          {{ cancelling ? 'Cancelling...' : 'Cancel' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { Button, TokenAmountWithLabel } from '@decentraguild/ui/components'
import type { EscrowWithAddress } from '@decentraguild/web3'
import { useEscrowDisplay } from '~/composables/useEscrowDisplay'

const props = defineProps<{
  escrow: EscrowWithAddress
  escrowLink: string | { path: string; query?: Record<string, string> }
  showQuickCancel?: boolean
  cancelling?: boolean
}>()

defineEmits<{ cancel: [] }>()

const escrowRef = toRef(props, 'escrow')
const { data } = useEscrowDisplay(escrowRef)
const display = computed(() => data.value)
</script>

<style scoped>
.manage-escrow-card {
  background: var(--theme-bg-card);
  border: var(--theme-border-thin) solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
}

.manage-escrow-card__body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-md);
}

.manage-escrow-card__summary {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-primary);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--theme-space-xs);
}

.manage-escrow-card__at {
  color: var(--theme-text-muted);
}

.manage-escrow-card__per {
  color: var(--theme-text-muted);
  font-size: var(--theme-font-xs);
}

.manage-escrow-card__loading {
  color: var(--theme-text-muted);
}

.manage-escrow-card__actions {
  display: flex;
  gap: var(--theme-space-sm);
}

.manage-escrow-card__link {
  text-decoration: none;
}
</style>
