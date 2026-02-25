/** API version path prefix. Single source of truth for client request paths. */
export const API_V1 = '/api/v1'

/**
 * Normalize API base URL (trim trailing slash). Single source of truth for the formula.
 * Use useApiBase() in components; use this in store/plugin when config is already available.
 */
export function normalizeApiBase(apiUrl: string | undefined): string {
  return (apiUrl ?? '').toString().replace(/\/$/, '')
}
