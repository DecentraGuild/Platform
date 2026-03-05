<template>
  <article class="dguild-center">
    <span class="dguild-center__bg-icon" aria-hidden="true">
      <Icon icon="mdi:home" height="none" class="dguild-center__bg-icon-svg" />
    </span>
    <div class="dguild-center__left">
      <NuxtLink to="/onboard" class="dguild-center__cta">
        <Button variant="primary" size="sm">Create org</Button>
      </NuxtLink>
    </div>
    <div class="dguild-center__right">
      <span class="dguild-center__label">dGuild - Build your Own</span>
      <p class="dguild-center__desc">{{ intro }}</p>
      <ul class="dguild-center__key-info">
        <li v-for="(item, i) in keyPoints" :key="i">{{ item }}</li>
      </ul>
      <p class="dguild-center__desc">{{ designedFor }}</p>
      <p class="dguild-center__desc">{{ protocolLayer }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from '@decentraguild/ui/components'

const intro = 'With dGuild BYO, partners can:'

const keyPoints = [
  'Select specific modules from the catalog',
  'Define custom module combinations',
  'Adjust logic parameters beyond standard tiers',
  'Build branded guild environments',
  'Integrate modules into external ecosystems',
]

const designedFor =
  'This solution is designed for DAOs, NFT ecosystems, gaming guilds, creator economies, and Web3 platforms seeking structured on-chain coordination without building everything from scratch.'

const protocolLayer =
  'It allows your project to use DecentraGuild as a modular protocol layer — while maintaining your identity and governance model.'
</script>

<style scoped>
.dguild-center {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.04), transparent 55%),
    var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.dguild-center:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
}

.dguild-center__bg-icon {
  position: absolute;
  left: 0%;
  bottom: -30%;
  width: 150%;
  height: 150%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  pointer-events: none;
}

.dguild-center__bg-icon-svg {
  display: block;
  width: 100%;
  height: 100%;
  color: var(--theme-primary);
  opacity: 0.12;
}

.dguild-center__bg-icon-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.dguild-center__left {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--theme-space-xl);
  min-width: 140px;
  color: var(--theme-text-primary);
}

.dguild-center__cta {
  text-decoration: none;
}

.dguild-center__right {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--theme-space-lg);
  border-left: 1px solid var(--theme-border);
  min-width: 0;
  flex: 1;
  text-align: left;
}

.dguild-center__label {
  font-size: var(--theme-font-lg);
  font-weight: 600;
  margin: 0 0 var(--theme-space-sm);
  color: var(--theme-text-primary);
}

.dguild-center__desc {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0 0 var(--theme-space-sm);
  line-height: 1.5;
}

.dguild-center__key-info {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--theme-space-xs);
  margin: var(--theme-space-sm) 0 var(--theme-space-sm);
  padding-right: var(--theme-space-lg);
  padding-left: 0;
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  list-style: disc;
  list-style-position: inside;
  text-align: left;
}

.dguild-center__key-info li {
  margin-bottom: 0;
}

@media (max-width: var(--theme-breakpoint-md)) {
  .dguild-center {
    flex-direction: column;
  }

  .dguild-center__right {
    border-left: none;
    border-top: 1px solid var(--theme-border);
    text-align: left;
  }

  .dguild-center__key-info {
    padding-right: 0;
    padding-left: var(--theme-space-lg);
    list-style-position: outside;
    text-align: left;
  }
}
</style>
