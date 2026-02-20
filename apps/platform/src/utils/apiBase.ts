/**
 * Normalize API base URL (trim trailing slash). Single source of truth for the formula.
 * Use useApiBase() in components; use this when config is already available.
 */
export function normalizeApiBase(apiUrl: string | undefined): string {
  return (apiUrl ?? '').toString().replace(/\/$/, '')
}
