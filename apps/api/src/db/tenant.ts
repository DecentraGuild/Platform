import { type TenantConfig, normalizeModules } from '@decentraguild/core'
import { loadTenantBySlug, loadTenantById, loadTenantByIdOrSlug, writeTenantBySlug, writeTenantByIdOrSlug, getTenantConfigDir } from '../config/registry.js'
import { getPool, query } from './client.js'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

const toDbRow = (t: TenantConfig) => ({
  id: t.id,
  slug: t.slug ?? null,
  name: t.name,
  description: t.description ?? null,
  branding: JSON.stringify(t.branding ?? {}),
  modules: JSON.stringify(t.modules ?? {}),
  admins: JSON.stringify(t.admins ?? []),
  treasury: t.treasury ?? null,
})

function parseJsonField<T>(val: unknown): T {
  if (typeof val === 'string') return JSON.parse(val) as T
  return (val ?? null) as T
}

/** Map a tenant_config row (JSONB as string or object) to TenantConfig. */
export function rowToTenantConfig(row: Record<string, unknown>): TenantConfig {
  const rawModules = parseJsonField<unknown>(row.modules)
  return {
    id: row.id as string,
    slug: (row.slug as string) ?? undefined,
    name: row.name as string,
    description: (row.description as string) ?? undefined,
    branding: parseJsonField<Record<string, unknown>>(row.branding) ?? {},
    modules: normalizeModules(rawModules),
    admins: parseJsonField<string[]>(row.admins) ?? [],
    treasury: (row.treasury as string) ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString() : undefined,
  }
}

export async function getTenantBySlug(slug: string): Promise<TenantConfig | null> {
  const { rows } = await query<Record<string, unknown>>(
    'SELECT * FROM tenant_config WHERE slug = $1',
    [slug]
  )
  if (rows.length === 0) return null
  return rowToTenantConfig(rows[0])
}

export async function getTenantById(id: string): Promise<TenantConfig | null> {
  const { rows } = await query<Record<string, unknown>>(
    'SELECT * FROM tenant_config WHERE id = $1',
    [id]
  )
  if (rows.length === 0) return null
  return rowToTenantConfig(rows[0])
}

/**
 * Resolve tenant by id or slug. Tries slug first (for existing tenants), then id.
 * Production: DB first, then file fallback.
 * Local (non-production): file first (when TENANT_CONFIG_PATH set), then DB.
 */
export async function resolveTenant(idOrSlug: string): Promise<TenantConfig | null> {
  const fromDb = async () => {
    if (!getPool()) return null
    try {
      const bySlug = await getTenantBySlug(idOrSlug)
      if (bySlug) return bySlug
      const byId = await getTenantById(idOrSlug)
      if (byId) return byId
    } catch {
      // DB query failed
    }
    return null
  }
  const fromFile = async () => loadTenantByIdOrSlug(idOrSlug)

  if (isProduction()) {
    const t = await fromDb()
    if (t) return t
    return fromFile()
  }
  const t = await fromFile()
  if (t) return t
  return fromDb()
}

/** All tenant identifiers (slug or id) from DB. Used by module-lifecycle job to iterate tenants. */
export async function getAllTenantSlugs(): Promise<string[]> {
  const { rows } = await query<Record<string, unknown>>('SELECT id, slug FROM tenant_config')
  return rows.map((r) => (r.slug as string) ?? (r.id as string)).filter(Boolean)
}

export async function upsertTenant(config: TenantConfig): Promise<void> {
  const r = toDbRow(config)
  await query(
    `INSERT INTO tenant_config (id, slug, name, description, branding, modules, admins, treasury, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, COALESCE((SELECT created_at FROM tenant_config WHERE id = $1), NOW()), NOW())
     ON CONFLICT (id) DO UPDATE SET
       slug = EXCLUDED.slug,
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       branding = EXCLUDED.branding,
       modules = EXCLUDED.modules,
       admins = EXCLUDED.admins,
       treasury = EXCLUDED.treasury,
       updated_at = NOW()`,
    [r.id, r.slug, r.name, r.description, r.branding, r.modules, r.admins, r.treasury]
  )
}

export type TenantSettingsPatch = Partial<{
  name: string
  description: string
  slug: string | null
  branding: Partial<TenantConfig['branding']>
  modules: TenantConfig['modules']
}>

/** Merge patch into existing tenant config. Used by both DB and file save. */
export function mergeTenantPatch(existing: TenantConfig, patch: TenantSettingsPatch): TenantConfig {
  const merged: TenantConfig = {
    ...existing,
    ...patch,
    id: existing.id,
    slug: patch.slug !== undefined ? patch.slug ?? undefined : existing.slug,
  }
  if (patch.branding) {
    merged.branding = { ...existing.branding, ...patch.branding }
    const existingTheme = existing.branding?.theme as Record<string, unknown> | undefined
    const patchTheme = patch.branding.theme as Record<string, unknown> | undefined
    if (patchTheme && existingTheme) {
      const existingColors = (existingTheme.colors ?? {}) as Record<string, Record<string, string>>
      const patchColors = (patchTheme.colors ?? {}) as Record<string, Record<string, string>>
      const colorKeys = new Set([...Object.keys(existingColors), ...Object.keys(patchColors)])
      const colors: Record<string, Record<string, string>> = {}
      for (const k of colorKeys) {
        colors[k] = { ...existingColors[k], ...patchColors[k] }
      }
      merged.branding.theme = {
        ...existingTheme,
        ...patchTheme,
        colors,
        fontSize: { ...(existingTheme.fontSize as Record<string, string>), ...(patchTheme.fontSize as Record<string, string>) },
        spacing: { ...(existingTheme.spacing as Record<string, string>), ...(patchTheme.spacing as Record<string, string>) },
        borderRadius: { ...(existingTheme.borderRadius as Record<string, string>), ...(patchTheme.borderRadius as Record<string, string>) },
        borderWidth: { ...(existingTheme.borderWidth as Record<string, string>), ...(patchTheme.borderWidth as Record<string, string>) },
        shadows: { ...(existingTheme.shadows as Record<string, string>), ...(patchTheme.shadows as Record<string, string>) },
        gradients: { ...(existingTheme.gradients as Record<string, string>), ...(patchTheme.gradients as Record<string, string>) },
        fonts: { ...(existingTheme.fonts as Record<string, string[]>), ...(patchTheme.fonts as Record<string, string[]>) },
      }
    } else if (patchTheme) {
      merged.branding.theme = patchTheme
    }
  }
  if (patch.modules !== undefined) merged.modules = normalizeModules(patch.modules as unknown)
  return merged
}

/**
 * Update tenant by id or slug with a patch. Merge is always applied in memory.
 * Production: persist to DB only.
 * Local: persist to file first (when TENANT_CONFIG_PATH set), then to DB if available.
 */
export async function updateTenant(idOrSlug: string, patch: TenantSettingsPatch): Promise<TenantConfig | null> {
  const existing = await resolveTenant(idOrSlug)
  if (!existing) return null
  const merged = mergeTenantPatch(existing, patch)

  if (isProduction()) {
    if (getPool()) {
      await upsertTenant(merged)
      return getTenantById(merged.id)
    }
    return merged
  }

  const configDir = getTenantConfigDir()
  if (configDir) {
    try {
      const fileId = merged.slug ?? merged.id
      await writeTenantByIdOrSlug(fileId, merged)
    } catch {
      // Caller may still want to persist to DB; continue
    }
  }
  if (getPool()) {
    await upsertTenant(merged).catch(() => {})
  }
  return merged
}
