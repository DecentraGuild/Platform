import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { type TenantConfig, normalizeModules } from '@decentraguild/core'
import { getPool, query } from '../db/client.js'
import { getTenantById, getTenantBySlug, rowToTenantConfig, upsertTenant } from '../db/tenant.js'
import { getWalletFromRequest } from './auth.js'
import { listTenantSlugs, loadTenantByIdOrSlug } from '../config/registry.js'
import { isValidTenantId } from '../validate-slug.js'
import { tenantCreateRateLimit } from '../rate-limit-strict.js'
import { apiError, ErrorCode } from '../api-errors.js'

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateTenantId(): string {
  const bytes = randomBytes(8)
  return 'dg_' + Array.from(bytes).map((b) => ALPHANUM[b % ALPHANUM.length]).join('')
}

export async function registerTenantsRoutes(app: FastifyInstance) {
  // Public for discovery (e.g. platform app directory). No auth required.
  app.get('/api/v1/tenants', async (_request, _reply) => {
    let tenants: TenantConfig[] = []

    if (getPool()) {
      const { rows } = await query<Record<string, unknown>>('SELECT * FROM tenant_config ORDER BY name')
      tenants = rows.map((row) => rowToTenantConfig(row))
    }

    if (tenants.length === 0) {
      const ids = await listTenantSlugs()
      for (const idOrSlug of ids) {
        const t = await loadTenantByIdOrSlug(idOrSlug)
        if (t) tenants.push(t)
      }
      tenants.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    }

    return { tenants }
  })

  app.post<{
    Body: Partial<TenantConfig> & { slug?: string; name: string }
  }>('/api/v1/tenants', { preHandler: [tenantCreateRateLimit] }, async (request, reply) => {
    const wallet = await getWalletFromRequest(request)
    if (!wallet) {
      return reply.status(401).send(apiError('Authentication required to create an org', ErrorCode.UNAUTHORIZED))
    }
    if (!getPool()) {
      return reply.status(503).send(apiError('Database not configured', ErrorCode.SERVICE_UNAVAILABLE))
    }
    const body = request.body
    if (!body?.name || typeof body.name !== 'string') {
      return reply.status(400).send(apiError('name is required', ErrorCode.BAD_REQUEST))
    }
    let id: string = ''
    let slug: string | null = null

    if (body.slug && body.slug.trim()) {
      const slugNorm = body.slug.trim().toLowerCase()
      const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
      if (!slugRegex.test(slugNorm) || slugNorm.length > 64) {
        return reply.status(400).send(apiError('Invalid slug: use only lowercase letters, numbers, and hyphens (1–64 chars)', ErrorCode.INVALID_SLUG))
      }
      const existingDb = await getTenantBySlug(slugNorm)
      if (existingDb) {
        return reply.status(409).send(apiError('Tenant slug already taken', ErrorCode.CONFLICT, { slug: slugNorm }))
      }
      const existingFile = await loadTenantByIdOrSlug(slugNorm)
      if (existingFile) {
        return reply.status(409).send(apiError('Tenant slug already taken', ErrorCode.CONFLICT, { slug: slugNorm }))
      }
      slug = slugNorm
      id = body.id ?? slugNorm
    } else {
      for (let attempts = 0; attempts < 20; attempts++) {
        const candidate = generateTenantId()
        const existingDb = await getTenantById(candidate)
        if (existingDb) continue
        const existingFile = await loadTenantByIdOrSlug(candidate)
        if (existingFile) continue
        id = candidate
        break
      }
      if (!id) id = generateTenantId()
    }

    const config: TenantConfig = {
      id,
      slug: slug ?? undefined,
      name: body.name.trim(),
      description: body.description?.trim(),
      branding: body.branding ?? {},
      modules: normalizeModules(body.modules ?? [{ id: 'admin', enabled: true }]),
      admins: [wallet],
      treasury: body.treasury?.trim(),
    }
    await upsertTenant(config)
    const tenant = slug ? await getTenantBySlug(slug) : await getTenantById(id)
    return { tenant }
  })
}
