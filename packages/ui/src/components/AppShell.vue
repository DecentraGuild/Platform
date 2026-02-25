<template>
  <div class="app-shell" :class="{ 'app-shell--nav-open': mobileNavOpen }">
    <header v-if="$slots.header" class="app-shell__header">
      <slot name="header" />
    </header>
    <div class="app-shell__body">
      <template v-if="$slots.nav">
        <div
          v-show="mobileNavOpen"
          class="app-shell__overlay"
          aria-hidden="true"
          @click="$emit('update:mobileNavOpen', false)"
        />
        <nav class="app-shell__nav">
          <button
            type="button"
            class="app-shell__nav-close"
            aria-label="Close menu"
            @click="$emit('update:mobileNavOpen', false)"
          >
            <slot name="nav-close-icon">
              <Icon icon="mdi:close" />
            </slot>
          </button>
          <slot name="nav" />
        </nav>
      </template>
      <main class="app-shell__main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(
  defineProps<{
    mobileNavOpen?: boolean
  }>(),
  { mobileNavOpen: false }
)
defineEmits<{
  'update:mobileNavOpen': [value: boolean]
}>()
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.app-shell__header {
  flex-shrink: 0;
  background-color: var(--theme-bg-secondary);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.app-shell__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.app-shell__overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.5);
}

.app-shell__nav {
  flex-shrink: 0;
  align-self: stretch;
  background-color: var(--theme-bg-secondary);
  border-right: var(--theme-border-thin) solid var(--theme-border);
  padding: var(--theme-space-md);
}

.app-shell__nav-close {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: 0 0 var(--theme-space-sm);
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.app-shell__nav-close:hover {
  color: var(--theme-text-primary);
  background: var(--theme-bg-card);
}

.app-shell__main {
  flex: 1;
  min-width: 0;
  padding: var(--theme-space-xl);
}

@media (min-width: var(--theme-breakpoint-md)) {
  .app-shell__nav {
    min-width: 12rem;
  }
}

@media (max-width: var(--theme-breakpoint-md)) {
  .app-shell__overlay {
    display: block;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .app-shell--nav-open .app-shell__overlay {
    opacity: 1;
    pointer-events: auto;
  }

  .app-shell__nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 101;
    width: 280px;
    max-width: 85vw;
    border-right: var(--theme-border-thin) solid var(--theme-border);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    overflow-y: auto;
  }

  .app-shell--nav-open .app-shell__nav {
    transform: translateX(0);
  }

  .app-shell__nav-close {
    display: flex;
  }
}
</style>
