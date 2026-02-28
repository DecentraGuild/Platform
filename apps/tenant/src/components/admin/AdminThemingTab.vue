<template>
  <div class="admin__panel">
    <AdminThemeSettings :branding="branding" />
  </div>
</template>

<script setup lang="ts">
import AdminThemeSettings from '~/components/AdminThemeSettings.vue'

defineProps<{
  branding: { logo: string; theme: Record<string, unknown> }
}>()
</script>
