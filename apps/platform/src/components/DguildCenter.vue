<template>
  <article
    class="dguild-center"
    :class="{ 'dguild-center--expanded': expanded }"
  >
    <button
      type="button"
      class="dguild-center__trigger"
      :aria-expanded="expanded"
      :aria-controls="'dguild-center-content'"
      id="dguild-center-trigger"
      @click="emit('toggle')"
    >
      <span class="dguild-center__icon-wrap">
        <Icon icon="mdi:home" class="dguild-center__icon" />
      </span>
      <span class="dguild-center__label">dGuild</span>
    </button>
    <div
      id="dguild-center-content"
      class="dguild-center__content"
      role="region"
      aria-labelledby="dguild-center-trigger"
      :hidden="!expanded"
      @click="expanded && emit('toggle')"
    >
      <p class="dguild-center__desc">{{ intro }}</p>
      <ul class="dguild-center__key-info">
        <li v-for="(item, i) in keyPoints" :key="i">{{ item }}</li>
      </ul>
      <NuxtLink to="/onboard" class="dguild-center__cta" @click.stop>
        <Button variant="primary" size="sm">Create org</Button>
      </NuxtLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from '@decentraguild/ui/components'

defineProps<{
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const intro =
  'dGuild is your organisation on DecentraGuild. Build your community hub with your own subdomain, branding, and modules.'

const keyPoints = [
  'Own your branding, subdomain, and settings',
  'Enable modules per your needs (marketplace, Discord, and more)',
  'Build Your Own offering for your community',
]
</script>

<style scoped>
.dguild-center {
  display: flex;
  flex-direction: row;
  background: var(--theme-bg-card);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  overflow: hidden;
  flex-shrink: 0;
}

.dguild-center__trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--theme-space-md);
  padding: var(--theme-space-xl);
  min-width: 120px;
  min-height: 120px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--theme-text-primary);
  text-align: center;
  transition: background-color 0.15s ease;
}

.dguild-center__trigger:hover {
  background: var(--theme-bg-secondary);
}

.dguild-center__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--theme-radius-md);
  background: var(--theme-bg-secondary);
}

.dguild-center__icon {
  font-size: 2rem;
  color: var(--theme-primary);
}

.dguild-center__label {
  font-size: var(--theme-font-lg);
  font-weight: 600;
}

.dguild-center__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--theme-space-lg);
  border-left: 1px solid var(--theme-border);
  min-width: 0;
  max-width: 280px;
}

.dguild-center__content[hidden] {
  display: none;
}

.dguild-center--expanded .dguild-center__content {
  cursor: pointer;
}

.dguild-center__desc {
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.dguild-center__key-info {
  margin: var(--theme-space-sm) 0 0;
  padding-left: var(--theme-space-lg);
  font-size: var(--theme-font-sm);
  color: var(--theme-text-secondary);
}

.dguild-center__key-info li {
  margin-bottom: var(--theme-space-xs);
}

.dguild-center__cta {
  margin-top: var(--theme-space-md);
  text-decoration: none;
}

@media (max-width: var(--theme-breakpoint-md)) {
  .dguild-center {
    flex-direction: column;
  }

  .dguild-center__content {
    border-left: none;
    border-top: 1px solid var(--theme-border);
    max-width: none;
  }
}
</style>
