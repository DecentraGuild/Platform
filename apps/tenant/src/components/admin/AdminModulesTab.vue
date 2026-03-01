<template>
  <div class="admin__split">
    <div class="admin__panel">
    <Card>
      <h3>Modules</h3>
      <div
        v-for="id in moduleIds"
        :key="id"
        class="admin__module"
        :class="{ 'admin__module--staging': form.modulesById[id] === 'staging' }"
      >
        <span class="admin__module-name">
          {{ MODULE_NAV[id]?.label ?? id }}
          <button
            v-if="id !== 'admin' && getModuleCatalogEntry(id)"
            type="button"
            class="admin__module-info-btn"
            :aria-label="`Info about ${MODULE_NAV[id]?.label ?? id}`"
            @click="openModuleInfo(id)"
          >
            <Icon icon="mdi:information-outline" class="admin__module-info-icon" />
          </button>
        </span>
        <div v-if="id !== 'admin'" class="admin__module-controls">
          <span v-if="moduleDeactivationDate(id)" class="admin__module-date">
            Deactivate at {{ formatDeactivationDate(moduleDeactivationDate(id)) }}
          </span>
          <Toggle
            :model-value="isModuleOn(id)"
            @update:model-value="$emit('module-toggle', id, $event)"
          />
          <span v-if="form.modulesById[id] === 'staging'" class="admin__module-staging-label">Staging</span>
          <template v-else-if="form.modulesById[id] === 'active' && isModuleBillable(id)">
            <div v-if="extendingModuleId === id" class="admin__extend-inline">
              <div class="pricing-widget__period-toggle">
                <button
                  class="pricing-widget__period-btn"
                  :class="{ 'pricing-widget__period-btn--active': extendPeriod === 'monthly' }"
                  @click="$emit('update:extendPeriod', 'monthly')"
                >Month</button>
                <button
                  class="pricing-widget__period-btn"
                  :class="{ 'pricing-widget__period-btn--active': extendPeriod === 'yearly' }"
                  @click="$emit('update:extendPeriod', 'yearly')"
                >Year</button>
              </div>
              <Button variant="primary" size="sm" :disabled="extending" @click="$emit('confirm-extend', id)">
                {{ extending ? 'Extending...' : 'Confirm' }}
              </Button>
              <button class="admin__extend-cancel" @click="$emit('cancel-extend')">
                <Icon icon="mdi:close" />
              </button>
            </div>
            <Button v-else variant="secondary" size="sm" @click="$emit('start-extend', id)">
              Extend
            </Button>
          </template>
        </div>
        <span v-else class="admin__module-always-on">Always on</span>
      </div>
    </Card>

    <Modal
      :model-value="!!infoModuleId"
      :title="infoModule?.name ?? ''"
      @update:model-value="infoModuleId = null"
    >
      <div v-if="infoModule" class="admin__module-info-modal">
        <p class="admin__module-info-desc">{{ infoModule.longDescription }}</p>
        <a
          :href="docsModuleUrl"
          target="_blank"
          rel="noopener"
          class="admin__module-info-link"
        >
          Learn more
          <Icon icon="mdi:open-in-new" />
        </a>
      </div>
    </Modal>
    </div>
    <div aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import type { BillingPeriod } from '@decentraguild/billing'
import { Card, Toggle, Button, Modal } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { MODULE_NAV } from '~/config/modules'
import type { ModuleCatalogEntry } from '@decentraguild/config'

const config = useRuntimeConfig()
const platformDocsBase = config.public.platformDocsUrl as string ?? 'https://dguild.org/docs'

const infoModuleId = ref<string | null>(null)
const infoModule = computed<ModuleCatalogEntry | null>(() =>
  infoModuleId.value ? getModuleCatalogEntry(infoModuleId.value) ?? null : null
)
const docsModuleUrl = computed(() =>
  infoModuleId.value
    ? `${platformDocsBase.replace(/\/$/, '')}/modules/${infoModuleId.value}`
    : ''
)

function openModuleInfo(id: string) {
  infoModuleId.value = id
}

import type { TenantConfig } from '@decentraguild/core'
import type { AdminForm } from '~/composables/useAdminForm'

const props = defineProps<{
  form: AdminForm
  tenant: TenantConfig | null
  moduleIds: string[]
  subscriptions: Record<string, { periodEnd?: string } | null>
  extendingModuleId: string | null
  extending: boolean
  extendPeriod: BillingPeriod
}>()

defineEmits<{
  'module-toggle': [id: string, on: boolean]
  'start-extend': [id: string]
  'confirm-extend': [id: string]
  'cancel-extend': []
  'update:extendPeriod': [value: BillingPeriod]
}>()

function moduleDeactivationDate(moduleId: string): string | null {
  const entry = props.tenant?.modules?.[moduleId] as { deactivatedate?: string | null } | undefined
  const d = entry?.deactivatedate
  return d && typeof d === 'string' ? d : null
}

function formatDeactivationDate(iso: string): string {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function isModuleOn(moduleId: string): boolean {
  const s = props.form.modulesById[moduleId] ?? 'off'
  return s === 'staging' || s === 'active' || s === 'deactivating'
}

function isModuleBillable(moduleId: string): boolean {
  return getModuleCatalogEntry(moduleId)?.pricing != null
}
</script>
