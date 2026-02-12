<template>
  <div class="app-header">
    <slot name="logo">
      <img
        v-if="logo"
        :src="logo"
        :alt="name"
        class="app-header__logo"
      />
      <span v-else class="app-header__name">{{ name || 'dGuild' }}</span>
    </slot>
    <div class="app-header__right">
      <div v-if="$slots.nav" class="app-header__nav">
        <slot name="nav" />
      </div>
      <div v-if="$slots.actions" class="app-header__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  logo?: string
  name?: string
}>()
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-md) var(--theme-space-xl);
}

.app-header__logo {
  height: 2rem;
  width: auto;
  border-radius: var(--theme-radius-md);
}

.app-header__name {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
}

.app-header__right {
  display: flex;
  gap: var(--theme-space-lg);
  align-items: center;
}

.app-header__nav {
  display: flex;
  gap: var(--theme-space-sm);
  align-items: center;
}

.app-header__actions {
  display: flex;
  align-items: center;
}
</style>
