/**
 * Module lifecycle job: transition active -> deactivating when deactivatedate reached,
 * and deactivating -> off when deactivatingUntil reached.
 * Run on an interval (e.g. every minute for testing, daily for production).
 */

import type { TenantConfig, TenantModuleEntry, TenantModulesMap } from '@decentraguild/core'
import { normalizeModules } from '@decentraguild/core'
import { DEFAULT_MODULE_LIFECYCLE_DEACTIVATING_MINUTES } from '../config/constants.js'
import { getPool } from '../db/client.js'
import { resolveTenant, updateTenant, getAllTenantSlugs } from '../db/tenant.js'
import { listTenantSlugs, writeTenantBySlug } from '../config/registry.js'

const DEACTIVATING_MINUTES = Number(process.env.MODULE_LIFECYCLE_DEACTIVATING_MINUTES ?? DEFAULT_MODULE_LIFECYCLE_DEACTIVATING_MINUTES)

function parseDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null
  const s = typeof value === 'string' ? value : String(value)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function applyLifecycleTransitions(
  modules: TenantModulesMap,
  now: Date,
  logDebug?: (data: unknown) => void
): { modules: TenantModulesMap; changed: boolean } {
  const addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60 * 1000)
  const next: TenantModulesMap = {}
  let changed = false

  for (const [id, entry] of Object.entries(modules)) {
    if (id === 'admin') {
      next[id] = entry as TenantModuleEntry
      continue
    }
    const e = entry as TenantModuleEntry
    let upd: TenantModuleEntry = { ...e }

    const deactivateAt = parseDate(e.deactivatedate)
    if (e.state === 'active') {
      if (logDebug) {
        logDebug({
          moduleId: id,
          state: e.state,
          deactivatedate: e.deactivatedate ?? null,
          deactivateAt: deactivateAt?.toISOString() ?? null,
          now: now.toISOString(),
          willTransition: !!(deactivateAt && deactivateAt <= now),
        })
      }
    }
    if (e.state === 'active' && deactivateAt) {
      const at = deactivateAt
      const shouldTransition = at <= now
      if (shouldTransition) {
        upd = {
          ...e,
          state: 'deactivating',
          deactivatingUntil: addMinutes(now, DEACTIVATING_MINUTES).toISOString(),
        }
        changed = true
      }
    }

    const untilDate = parseDate(upd.deactivatingUntil)
    if (upd.state === 'deactivating' && untilDate) {
      if (untilDate <= now) {
        upd = {
          ...e,
          state: 'off',
          deactivatedate: null,
          deactivatingUntil: null,
        }
        changed = true
      }
    }

    next[id] = upd
  }

  return { modules: changed ? normalizeModules(next) : modules, changed }
}

export async function runModuleLifecycle(log: { info: (o: unknown, msg?: string) => void; warn: (o: unknown, msg?: string) => void }): Promise<void> {
  const pool = getPool()
  let slugs = pool ? await getAllTenantSlugs() : await listTenantSlugs()
  if (pool && slugs.length === 0) {
    slugs = await listTenantSlugs()
    if (slugs.length > 0) {
      log.info({ slugs }, 'Module lifecycle: DB had no tenants; using file config slugs')
    }
  }
  if (slugs.length === 0) return

  const now = new Date()
  log.info({ tenantCount: slugs.length, slugs, now: now.toISOString() }, 'Module lifecycle run')
  for (const slug of slugs) {
    const tenant = await resolveTenant(slug)
    if (!tenant) continue

    const logDebug = (data: unknown) => log.info({ slug, ...(data as object) }, 'Module lifecycle check')
    const { modules: nextModules, changed } = applyLifecycleTransitions(tenant.modules ?? {}, now, logDebug)
    if (!changed) continue

    const updated: TenantConfig = { ...tenant, modules: nextModules }
    try {
      if (pool) {
        const result = await updateTenant(slug, { modules: nextModules })
        if (result) {
          log.info(
            { slug, states: Object.fromEntries(Object.entries(nextModules).map(([k, v]) => [k, (v as TenantModuleEntry).state])) },
            'Module lifecycle updated (DB)'
          )
        }
      } else {
        await writeTenantBySlug(slug, updated)
        log.info(
          { slug, states: Object.fromEntries(Object.entries(nextModules).map(([k, v]) => [k, (v as TenantModuleEntry).state])) },
          'Module lifecycle updated (file)'
        )
      }
    } catch (err) {
      log.warn({ err, slug }, 'Module lifecycle update failed')
    }
  }
}
