<template>
  <div class="platform-layout" :class="{ 'platform-layout--nav-open': mobileNavOpen }">
    <header class="platform-header">
      <div class="platform-header__left">
        <NuxtLink to="/" class="platform-header__brand">
          <img
            src="https://www.decentraguild.com/logo/dguild-logo.svg"
            alt="DecentraGuild logo"
            class="platform-header__logo"
          />
          <span class="platform-header__brand-text">DecentraGuild</span>
        </NuxtLink>
        <nav class="platform-header__nav platform-header__nav--desktop" aria-label="Main">
          <NuxtLink to="/modules" :prefetch="false">Modules</NuxtLink>
          <NuxtLink to="/directory">Discover</NuxtLink>
          <NuxtLink to="/onboard">Create org</NuxtLink>
        </nav>
      </div>
      <div class="platform-header__right">
        <button
          type="button"
          class="platform-header__burger"
          aria-label="Open menu"
          :aria-expanded="mobileNavOpen"
          @click="mobileNavOpen = true"
        >
          <Icon icon="mdi:menu" aria-hidden />
        </button>
        <AuthWidget />
      </div>
    </header>

    <div
      v-show="mobileNavOpen"
      class="platform-layout__overlay"
      aria-hidden="true"
      @click="mobileNavOpen = false"
    />
    <aside
      class="platform-nav-drawer"
      :class="{ 'platform-nav-drawer--open': mobileNavOpen }"
      aria-label="Main navigation"
      role="dialog"
      :aria-modal="mobileNavOpen"
    >
      <button
        type="button"
        class="platform-nav-drawer__close"
        aria-label="Close menu"
        @click="mobileNavOpen = false"
      >
        <Icon icon="mdi:close" aria-hidden />
      </button>
      <nav class="platform-nav-drawer__nav">
        <NuxtLink to="/modules" :prefetch="false" @click="mobileNavOpen = false">Modules</NuxtLink>
        <NuxtLink to="/directory" @click="mobileNavOpen = false">Discover</NuxtLink>
        <NuxtLink to="/onboard" @click="mobileNavOpen = false">Create org</NuxtLink>
      </nav>
    </aside>

    <main class="platform-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { AuthWidget } from '@decentraguild/auth'

const route = useRoute()
const mobileNavOpen = ref(false)

watch(
  () => route.path,
  () => {
    mobileNavOpen.value = false
  }
)
</script>

<style scoped>
.platform-layout {
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 0 var(--theme-space-xl);
  background-color: var(--theme-bg-secondary);
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.platform-header__left {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xl);
  min-height: 56px;
}

.platform-header__brand {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
  text-decoration: none;
  min-height: 56px;
}

.platform-header__logo {
  display: block;
  height: 28px;
  width: auto;
  flex-shrink: 0;
}

.platform-header__brand-text {
  flex-shrink: 0;
}

.platform-header__nav {
  display: flex;
  align-items: center;
  gap: var(--theme-space-lg);
}

.platform-header__nav a {
  color: var(--theme-text-secondary);
  text-decoration: none;
  line-height: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.platform-header__nav a:hover {
  color: var(--theme-primary);
}

.platform-header__nav .router-link-active {
  color: var(--theme-primary);
  font-weight: 600;
}

.platform-header__right {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  min-height: 56px;
}

.platform-header__burger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-secondary);
  cursor: pointer;
}

.platform-header__burger:hover {
  color: var(--theme-text-primary);
  background: var(--theme-bg-card);
}

.platform-main {
  padding: var(--theme-space-xl);
}

/* Overlay and nav drawer (mobile) */
.platform-layout__overlay {
  display: none;
}

.platform-nav-drawer {
  display: none;
}

@media (max-width: var(--theme-breakpoint-md)) {
  .platform-header {
    padding: 0 var(--theme-space-md);
  }

  .platform-header__nav--desktop {
    display: none;
  }

  .platform-header__burger {
    display: flex;
  }

  .platform-main {
    padding: var(--theme-space-md);
  }

  .platform-layout__overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .platform-layout--nav-open .platform-layout__overlay {
    opacity: 1;
    pointer-events: auto;
  }

  .platform-nav-drawer {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 101;
    width: 280px;
    max-width: 85vw;
    padding: var(--theme-space-md);
    background-color: var(--theme-bg-secondary);
    border-right: var(--theme-border-thin) solid var(--theme-border);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    overflow-y: auto;
  }

  .platform-nav-drawer--open {
    transform: translateX(0);
  }

  .platform-nav-drawer__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    margin: 0 0 var(--theme-space-sm);
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--theme-radius-md);
    color: var(--theme-text-secondary);
    cursor: pointer;
  }

  .platform-nav-drawer__close:hover {
    color: var(--theme-text-primary);
    background: var(--theme-bg-card);
  }

  .platform-nav-drawer__nav {
    display: flex;
    flex-direction: column;
    gap: var(--theme-space-xs);
  }

  .platform-nav-drawer__nav a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 var(--theme-space-sm);
    color: var(--theme-text-secondary);
    text-decoration: none;
    border-radius: var(--theme-radius-md);
  }

  .platform-nav-drawer__nav a:hover {
    color: var(--theme-primary);
    background: var(--theme-bg-card);
  }

  .platform-nav-drawer__nav a.router-link-active {
    color: var(--theme-primary);
    font-weight: 600;
    background: var(--theme-bg-card);
  }
}
</style>
