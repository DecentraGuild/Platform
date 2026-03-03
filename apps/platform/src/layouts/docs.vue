<template>
  <div
    class="platform-layout docs-layout"
    :class="{
      'docs-layout--nav-open': mobileNavOpen,
      'docs-layout--sidebar-open': docsSidebarOpen,
    }"
  >
    <header class="platform-header">
      <div class="platform-header__left">
        <NuxtLink to="/" class="platform-header__brand">DecentraGuild</NuxtLink>
        <nav class="platform-header__nav platform-header__nav--desktop" aria-label="Main">
          <NuxtLink to="/docs" :prefetch="false">Docs</NuxtLink>
          <NuxtLink to="/directory">Discover</NuxtLink>
          <NuxtLink to="/onboard">Create org</NuxtLink>
        </nav>
      </div>
      <div class="platform-header__right">
        <button
          type="button"
          class="platform-header__contents"
          aria-label="Open docs contents"
          :aria-expanded="docsSidebarOpen"
          @click="openDocsSidebar"
        >
          Contents
        </button>
        <button
          type="button"
          class="platform-header__burger"
          aria-label="Open menu"
          :aria-expanded="mobileNavOpen"
          @click="openNav"
        >
          <Icon icon="mdi:menu" aria-hidden />
        </button>
        <AuthWidget />
      </div>
    </header>

    <!-- Nav drawer (mobile) -->
    <div
      v-show="mobileNavOpen"
      class="docs-layout__overlay docs-layout__overlay--nav"
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
        <NuxtLink to="/docs" :prefetch="false" @click="mobileNavOpen = false">Docs</NuxtLink>
        <NuxtLink to="/directory" @click="mobileNavOpen = false">Discover</NuxtLink>
        <NuxtLink to="/onboard" @click="mobileNavOpen = false">Create org</NuxtLink>
      </nav>
    </aside>

    <!-- Docs sidebar drawer (mobile) -->
    <div
      v-show="docsSidebarOpen"
      class="docs-layout__overlay docs-layout__overlay--sidebar"
      aria-hidden="true"
      @click="docsSidebarOpen = false"
    />
    <aside
      class="docs-sidebar-drawer"
      :class="{ 'docs-sidebar-drawer--open': docsSidebarOpen }"
      aria-label="Docs contents"
      role="dialog"
      :aria-modal="docsSidebarOpen"
    >
      <button
        type="button"
        class="docs-sidebar-drawer__close"
        aria-label="Close contents"
        @click="docsSidebarOpen = false"
      >
        <Icon icon="mdi:close" aria-hidden />
      </button>
      <div class="docs-sidebar-drawer__content">
        <DocsSidebar />
      </div>
    </aside>

    <div class="docs-body">
      <aside class="docs-sidebar docs-sidebar--desktop">
        <DocsSidebar />
      </aside>
      <main class="docs-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { AuthWidget } from '@decentraguild/auth'

const route = useRoute()
const mobileNavOpen = ref(false)
const docsSidebarOpen = ref(false)

function openNav() {
  docsSidebarOpen.value = false
  mobileNavOpen.value = true
}

function openDocsSidebar() {
  mobileNavOpen.value = false
  docsSidebarOpen.value = true
}

watch(
  () => route.path,
  () => {
    mobileNavOpen.value = false
    docsSidebarOpen.value = false
  }
)
</script>

<style scoped>
.platform-layout.docs-layout {
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: var(--theme-space-md) var(--theme-space-xl);
  background-color: var(--theme-bg-secondary);
  border-bottom: 1px solid var(--theme-border);
}

.platform-header__left {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xl);
  min-height: 56px;
}

.platform-header__brand {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  color: var(--theme-text-primary);
  text-decoration: none;
}

.platform-header__nav {
  display: flex;
  align-items: center;
  gap: var(--theme-space-lg);
}

.platform-header__nav a {
  color: var(--theme-text-secondary);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.platform-header__nav a:hover {
  color: var(--theme-primary);
}

.platform-header__right {
  display: flex;
  align-items: center;
  gap: var(--theme-space-sm);
  min-height: 56px;
}

.platform-header__contents,
.platform-header__burger {
  display: none;
}

.docs-body {
  display: flex;
  flex: 1;
  min-height: calc(100vh - 56px);
}

.docs-sidebar--desktop {
  width: 260px;
  flex-shrink: 0;
  padding: var(--theme-space-xl);
  border-right: 1px solid var(--theme-border);
  background-color: var(--theme-bg-secondary);
}

.docs-main {
  flex: 1;
  padding: var(--theme-space-2xl);
  overflow-x: hidden;
  max-width: 800px;
}

/* Mobile overlays and drawers */
.docs-layout__overlay {
  display: none;
}

.platform-nav-drawer,
.docs-sidebar-drawer {
  display: none;
}

@media (max-width: var(--theme-breakpoint-md)) {
  .platform-header {
    padding: var(--theme-space-md);
  }

  .platform-header__nav--desktop {
    display: none;
  }

  .platform-header__contents,
  .platform-header__burger {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 var(--theme-space-sm);
    font-size: var(--theme-font-sm);
    color: var(--theme-text-secondary);
    background: none;
    border: none;
    border-radius: var(--theme-radius-md);
    cursor: pointer;
  }

  .platform-header__contents:hover,
  .platform-header__burger:hover {
    color: var(--theme-text-primary);
    background: var(--theme-bg-card);
  }

  .platform-header__burger {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
  }

  .docs-body {
    flex-direction: column;
  }

  .docs-sidebar--desktop {
    display: none;
  }

  .docs-main {
    padding: var(--theme-space-md);
    max-width: none;
  }

  .docs-layout__overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .docs-layout--nav-open .docs-layout__overlay--nav,
  .docs-layout--sidebar-open .docs-layout__overlay--sidebar {
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

  .docs-sidebar-drawer {
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

  .docs-sidebar-drawer--open {
    transform: translateX(0);
  }

  .docs-sidebar-drawer__close {
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

  .docs-sidebar-drawer__close:hover {
    color: var(--theme-text-primary);
    background: var(--theme-bg-card);
  }

  .docs-sidebar-drawer__content {
    flex: 1;
    min-height: 0;
  }
}
</style>
