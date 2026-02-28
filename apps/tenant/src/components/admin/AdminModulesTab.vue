<template>
  <div class="admin__panel">
    <Card>
      <h3>Modules</h3>
      <div
        v-for="id in moduleIds"
        :key="id"
        class="admin__module"
      >
        <span>{{ MODULE_NAV[id]?.label ?? id }}</span>
        <div v-if="id !== 'admin'" class="admin__module-controls">
          <span v-if="moduleDeactivationDate(id)" class="admin__module-date">
            Deactivate at {{ formatDeactivationDate(moduleDeactivationDate(id)) }}
          </span>
          <Toggle
            :model-value="isModuleOn(id)"
            @update:model-value="$emit('module-toggle', id, $event)"
          />
          <template v-if="form.modulesById[id] === 'active' && isModuleBillable(id)">
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
  </div>
</template>

<script setup lang="ts">
import type { BillingPeriod } from '@decentraguild/billing'
import { Card, Toggle, Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { MODULE_NAV } from '~/config/modules'
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
