<template>
  <div class="admin__split">
    <div class="admin__panel">
      <Card>
        <h3>General</h3>
        <div class="admin__slug-row">
          <TextInput
            :model-value="tenant?.slug ?? tenant?.id ?? ''"
            :placeholder="tenant?.slug ?? tenant?.id ? undefined : 'Claim to unlock'"
            label="Slug"
            disabled
          />
          <Button
            v-if="!tenant?.slug"
            variant="primary"
            size="sm"
            :disabled="slugClaiming"
            class="admin__slug-enable-btn"
            @click="$emit('toggle-slug-unlock')"
          >
            {{ slugClaiming ? 'Claiming...' : (showSlugUnlock ? 'Cancel' : 'Unlock') }}
          </Button>
        </div>
        <div v-if="tenant?.id" class="admin__tenant-id">
          <span class="admin__tenant-id-label">Tenant ID</span>
          <code>{{ tenant.id }}</code>
          <span class="admin__tenant-id-hint">Use as <code>?tenant={{ tenant.slug ?? tenant.id }}</code> on localhost</span>
        </div>
        <div v-if="showSlugUnlock && !tenant?.slug" class="admin__slug-unlock">
          <TextInput
            :model-value="desiredSlug"
            label="Desired slug"
            placeholder="e.g. skull"
            @update:model-value="$emit('update:desiredSlug', $event)"
            @blur="$emit('slug-check-blur')"
          />
          <div v-if="slugCheckStatus === 'available'" class="admin__slug-available">
            <Icon icon="mdi:check-circle" class="admin__slug-check-icon" />
            <span>Available</span>
          </div>
          <div v-else-if="slugCheckStatus === 'taken'" class="admin__slug-taken">
            <Icon icon="mdi:close-circle" class="admin__slug-check-icon" />
            <span>Taken</span>
          </div>
          <div class="admin__slug-actions">
            <Button
              v-if="slugCheckStatus === 'checking'"
              variant="secondary"
              size="sm"
              disabled
            >
              Checking...
            </Button>
            <Button
              v-else-if="slugCheckStatus !== 'available'"
              variant="secondary"
              size="sm"
              :disabled="slugChecking"
              @click="$emit('check-slug')"
            >
              {{ slugChecking ? 'Checking...' : 'Check' }}
            </Button>
            <Button
              v-else
              variant="primary"
              size="sm"
              :disabled="slugClaiming"
              @click="$emit('claim-slug')"
            >
              {{ slugClaiming ? 'Claiming...' : 'Claim slug' }}
            </Button>
          </div>
        </div>
        <TextInput
          v-model="form.name"
          label="Name"
        />
        <TextInput
          v-model="form.description"
          label="Description"
        />
        <TextInput
          v-model="form.branding.logo"
          label="Logo URL"
          placeholder="https://..."
        />
        <TextInput
          v-model="form.discordServerInviteLink"
          label="Invite link to Discord"
          placeholder="https://discord.gg/..."
        />
      </Card>
    </div>
    <slot name="sidebar" />
  </div>
</template>

<script setup lang="ts">
import { Card, TextInput, Button } from '@decentraguild/ui/components'
import { Icon } from '@iconify/vue'
import type { AdminForm } from '~/composables/useAdminForm'
import type { TenantConfig } from '@decentraguild/core'

defineProps<{
  form: AdminForm
  tenant: TenantConfig | null
  showSlugUnlock: boolean
  desiredSlug: string
  slugCheckStatus: 'idle' | 'checking' | 'available' | 'taken'
  slugChecking: boolean
  slugClaiming: boolean
}>()

defineEmits<{
  'toggle-slug-unlock': []
  'update:desiredSlug': [value: string]
  'slug-check-blur': []
  'check-slug': []
  'claim-slug': []
}>()
</script>
