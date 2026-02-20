import { normalizeApiBase } from '~/utils/apiBase'

/**
 * API base URL from Nuxt runtime config. Trims trailing slash.
 * Use when building fetch URLs for the DecentraGuild API.
 */
export function useApiBase() {
  const config = useRuntimeConfig()
  return computed(() => normalizeApiBase(config.public.apiUrl as string))
}
