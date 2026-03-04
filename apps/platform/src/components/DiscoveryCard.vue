<template>
  <article
    class="discovery-card"
    :style="cardStyle"
  >
    <div class="discovery-card__overlay" aria-hidden="true" />
    <div class="discovery-card__content">
      <span
        class="discovery-card__gate"
        :class="{ 'discovery-card__gate--active': hasWhitelist }"
        :aria-label="hasWhitelist ? 'Whitelist gated' : 'Public'"
      >
        <Icon icon="mdi:gate" class="discovery-card__gate-icon" />
      </span>

      <div class="discovery-card__top">
        <h3 class="discovery-card__name">{{ tenant.name }}</h3>
        <p v-if="tenant.description" class="discovery-card__desc">{{ tenant.description }}</p>
      </div>

      <div class="discovery-card__bottom">
        <ul v-if="activeModulesWithGate.length" class="discovery-card__modules">
          <li
            v-for="(mod, i) in activeModulesWithGate"
            :key="i"
            class="discovery-card__module-row"
          >
            <span class="discovery-card__module-name">{{ mod.name }}</span>
            <span
              v-if="mod.hasGate"
              class="discovery-card__module-gate discovery-card__module-gate--active"
              aria-label="Whitelist gated"
            >
              <Icon icon="mdi:gate" class="discovery-card__module-gate-icon" />
            </span>
            <span
              v-else
              class="discovery-card__module-gate"
              aria-label="Public"
            >
              <Icon icon="mdi:gate" class="discovery-card__module-gate-icon" />
            </span>
          </li>
        </ul>

        <a
          :href="tenantUrl(tenant.id)"
          target="_blank"
          rel="noopener"
          class="discovery-card__visit"
        >
          <Button variant="primary">Visit</Button>
        </a>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { Button } from '@decentraguild/ui/components'
import type { TenantConfig } from '@decentraguild/core'
import type { ActiveModuleWithGate } from '~/composables/useDiscoveryFilters'

const props = defineProps<{
  tenant: TenantConfig
  tenantUrl: (idOrSlug: string) => string
  hasWhitelist: boolean
  activeModulesWithGate: ActiveModuleWithGate[]
}>()

const cardStyle = computed(() => {
  const logo = props.tenant?.branding?.logo
  if (!logo) return { background: 'var(--theme-bg-secondary)' }
  return {
    backgroundImage: `url(${logo})`,
  }
})
</script>

<style scoped>
.discovery-card {
  position: relative;
  aspect-ratio: 3 / 4;
  background-size: cover;
  background-position: center;
  background-color: var(--theme-bg-secondary);
  border-radius: var(--theme-radius-md);
  overflow: hidden;
  border: 1px solid var(--theme-border);
}

.discovery-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.5) 50%,
    rgba(0, 0, 0, 0.2) 100%
  );
}

.discovery-card__content {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--theme-space-sm) var(--theme-space-md);
  min-height: 0;
}

.discovery-card__gate {
  position: absolute;
  top: var(--theme-space-xs);
  right: var(--theme-space-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-text-muted);
}

.discovery-card__gate--active {
  color: var(--theme-primary);
}

.discovery-card__gate-icon {
  font-size: 1rem;
}

.discovery-card__top {
  flex-shrink: 0;
}

.discovery-card__name {
  margin: 0 0 var(--theme-space-xs);
  font-size: var(--theme-font-sm);
  font-weight: 600;
  color: var(--theme-text-primary);
  line-height: 1.25;
}

.discovery-card__desc {
  margin: 0;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-secondary);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.discovery-card__modules {
  margin: 0 0 var(--theme-space-sm);
  padding-left: var(--theme-space-md);
  list-style-type: disc;
  font-size: var(--theme-font-xs);
  color: var(--theme-text-secondary);
  line-height: 1.35;
}

.discovery-card__module-row {
  display: flex;
  align-items: center;
  gap: var(--theme-space-xs);
  margin-bottom: 0.25rem;
}

.discovery-card__module-row:last-child {
  margin-bottom: 0;
}

.discovery-card__module-name {
  flex: 1;
  min-width: 0;
}

.discovery-card__module-gate {
  flex-shrink: 0;
  display: inline-flex;
  color: var(--theme-text-muted);
}

.discovery-card__module-gate--active {
  color: var(--theme-primary);
}

.discovery-card__module-gate-icon {
  font-size: 0.875rem;
}

.discovery-card__bottom {
  margin-top: auto;
}

.discovery-card__visit {
  flex-shrink: 0;
  align-self: center;
  text-decoration: none;
}

.discovery-card__visit :deep(.btn) {
  padding: 0.25rem var(--theme-space-sm);
  font-size: var(--theme-font-xs);
}
</style>
