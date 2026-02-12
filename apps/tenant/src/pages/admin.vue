<template>
  <PageSection title="Admin">
    <div class="admin">
      <ul class="admin__tabs">
        <li>
          <button
            :class="{ active: tab === 'general' }"
            @click="tab = 'general'"
          >
            General
          </button>
        </li>
        <li>
          <button
            :class="{ active: tab === 'branding' }"
            @click="tab = 'branding'"
          >
            Branding
          </button>
        </li>
        <li>
          <button
            :class="{ active: tab === 'modules' }"
            @click="tab = 'modules'"
          >
            Modules
          </button>
        </li>
      </ul>

      <div v-if="tab === 'general'" class="admin__panel">
        <Card>
          <h3>General</h3>
          <TextInput
            v-model="form.name"
            label="Name"
          />
          <TextInput
            v-model="form.description"
            label="Description"
          />
        </Card>
      </div>

      <div v-else-if="tab === 'branding'" class="admin__panel">
        <Card>
          <h3>Branding</h3>
          <TextInput
            v-model="form.branding.logo"
            label="Logo URL"
          />
          <TextInput
            v-model="form.branding.primaryColor"
            label="Primary color (hex)"
          />
          <TextInput
            v-model="form.branding.secondaryColor"
            label="Secondary color (hex)"
          />
        </Card>
      </div>

      <div v-else-if="tab === 'modules'" class="admin__panel">
        <Card>
          <h3>Modules</h3>
          <div
            v-for="mod in tenant?.modules ?? []"
            :key="mod.id"
            class="admin__module"
          >
            <span>{{ MODULE_ROUTES[mod.id]?.label ?? mod.id }}</span>
            <Toggle v-model="form.modulesById[mod.id]" :label="mod.enabled ? 'On' : 'Off'" />
          </div>
        </Card>
      </div>

      <div class="admin__actions">
        <Button variant="primary" :disabled="saving" @click="save">
          Save
        </Button>
        <p v-if="saveError" class="admin__error">{{ saveError }}</p>
      </div>
    </div>
  </PageSection>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-auth' })
import { PageSection, Card, TextInput, Toggle, Button } from '@decentraguild/ui/components'
import { useThemeStore } from '@decentraguild/ui'
import { useTenantStore } from '~/stores/tenant'
import { MODULE_ROUTES } from '~/config/modules'

const tenantStore = useTenantStore()
const config = useRuntimeConfig()
const tenant = computed(() => tenantStore.tenant)
const slug = computed(() => tenantStore.slug)

const tab = ref<'general' | 'branding' | 'modules'>('general')
const saving = ref(false)
const saveError = ref<string | null>(null)

const form = reactive({
  name: '',
  description: '',
  branding: {
    logo: '',
    primaryColor: '',
    secondaryColor: '',
  },
  modulesById: {} as Record<string, boolean>,
})

watch(
  tenant,
  (t) => {
    if (!t) return
    form.name = t.name ?? ''
    form.description = t.description ?? ''
    form.branding.logo = t.branding?.logo ?? ''
    form.branding.primaryColor = t.branding?.theme?.colors?.primary?.main ?? ''
    form.branding.secondaryColor = t.branding?.theme?.colors?.secondary?.main ?? ''
    form.modulesById = Object.fromEntries(
      (t.modules ?? []).map((m) => [m.id, m.enabled])
    )
  },
  { immediate: true }
)

async function save() {
  if (!slug.value) return
  saving.value = true
  saveError.value = null
  try {
    const modules = (tenant.value?.modules ?? []).map((m) => ({
      ...m,
      enabled: form.modulesById[m.id] ?? m.enabled,
    }))
    const res = await fetch(`${config.public.apiUrl}/api/v1/tenant/${slug.value}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        branding: {
          logo: form.branding.logo,
          theme: {
            colors: {
              primary: form.branding.primaryColor ? { main: form.branding.primaryColor } : undefined,
              secondary: form.branding.secondaryColor ? { main: form.branding.secondaryColor } : undefined,
            },
          },
        },
        modules,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to save')
    }
    const data = await res.json()
    tenantStore.setTenant(data.tenant)
    useThemeStore().loadTheme(
      data.tenant.branding?.theme ?? {},
      data.tenant.branding
    )
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.admin__tabs {
  display: flex;
  gap: var(--theme-space-sm);
  margin-bottom: var(--theme-space-lg);
  list-style: none;
  padding: 0;
}

.admin__tabs button {
  padding: var(--theme-space-sm) var(--theme-space-md);
  background: transparent;
  color: var(--theme-text-secondary);
  border: none;
  cursor: pointer;
  border-radius: var(--theme-radius-md);
}

.admin__tabs button:hover,
.admin__tabs button.active {
  color: var(--theme-primary);
  background: var(--theme-bg-card);
}

.admin__panel {
  margin-bottom: var(--theme-space-lg);
}

.admin__panel h3 {
  font-size: var(--theme-font-lg);
  margin-bottom: var(--theme-space-md);
}

.admin__panel .text-input,
.admin__panel .toggle {
  margin-bottom: var(--theme-space-md);
}

.admin__module {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--theme-space-sm) 0;
  border-bottom: var(--theme-border-thin) solid var(--theme-border);
}

.admin__module:last-child {
  border-bottom: none;
}

.admin__actions {
  margin-top: var(--theme-space-lg);
}

.admin__error {
  color: var(--theme-error);
  font-size: var(--theme-font-sm);
  margin-top: var(--theme-space-sm);
}
</style>
