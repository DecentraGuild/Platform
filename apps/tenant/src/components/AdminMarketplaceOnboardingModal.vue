<template>
  <Modal :model-value="modelValue" title="Your Marketplace. Your Brand. Your Rules." @update:model-value="$emit('update:modelValue', $event)">
    <div class="onboarding">
      <p class="onboarding__intro">
        Launch a fully branded Solana marketplace. Set your fees, choose your currencies, and start earning from every trade.
      </p>
      <div class="onboarding__benefits">
        <div class="onboarding__benefit">
          <Icon icon="mdi:shield-lock-outline" class="onboarding__icon" />
          <span>Self-custody: users keep control of their assets</span>
        </div>
        <div class="onboarding__benefit">
          <Icon icon="mdi:palette" class="onboarding__icon" />
          <span>Full branding: your storefront, your look</span>
        </div>
        <div class="onboarding__benefit">
          <Icon icon="mdi:wallet" class="onboarding__icon" />
          <span>Multi-currency: SOL, USDC, custom tokens</span>
        </div>
        <div class="onboarding__benefit">
          <Icon icon="mdi:currency-usd" class="onboarding__icon" />
          <span>Set your fees: monetize every transaction</span>
        </div>
        <div class="onboarding__benefit">
          <Icon icon="mdi:shield-check" class="onboarding__icon" />
          <span>Royalties protected</span>
        </div>
      </div>
      <p class="onboarding__bullets">
        Trade NFTs and tokens, up to 250 mints per collection. Configure custom fees and standard or custom currencies.
      </p>
      <div class="onboarding__actions">
        <Button variant="primary" @click="$emit('update:modelValue', false)">
          Got it
        </Button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Modal, Button } from '@decentraguild/ui/components'

defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-lg);
}

.onboarding__intro {
  color: var(--theme-text-secondary);
  font-size: var(--theme-font-sm);
  line-height: 1.5;
}

.onboarding__benefits {
  display: flex;
  flex-direction: column;
  gap: var(--theme-space-sm);
}

.onboarding__benefit {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-primary);
}

.onboarding__icon {
  font-size: var(--theme-font-xl);
  color: var(--theme-primary);
  flex-shrink: 0;
}

.onboarding__bullets {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-muted);
  line-height: 1.5;
}

.onboarding__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--theme-space-sm);
}
</style>
