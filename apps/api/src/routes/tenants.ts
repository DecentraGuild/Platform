import type { FastifyInstance } from 'fastify'
import { type TenantConfig, normalizeModules } from '@decentraguild/core'
import { getPool, query } from '../db/client.js'
import { getTenantBySlug, rowToTenantConfig, upsertTenant } from '../db/tenant.js'
import { getWalletFromRequest } from './auth.js'
import { listTenantSlugs, loadTenantBySlug } from '../config/registry.js'
import { normalizeTenantSlug } from '../validate-slug.js'

export async function registerTenantsRoutes(app: FastifyInstance) {
  app.get('/api/v1/tenants', async (_request, _reply) => {
    let tenants: TenantConfig[] = []

    if (getPool()) {
      const { rows } = await query<Record<string, unknown>>('SELECT * FROM tenant_config ORDER BY name')
      tenants = rows.map((row) => rowToTenantConfig(row))
    }

    if (tenants.length === 0) {
      const slugs = await listTenantSlugs()
      for (const slug of slugs) {
        const t = await loadTenantBySlug(slug)
        if (t) tenants.push(t)
      }
      tenants.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    }

    return { tenants }
  })

  app.post<{
    Body: Partial<TenantConfig> & { slug: string; name: string }
  }>('/api/v1/tenants', async (request, reply) => {
    const wallet = await getWalletFromRequest(request)
    if (!wallet) {
      return reply.status(401).send({ error: 'Authentication required to create an org' })
    }
    if (!getPool()) {
      return reply.status(503).send({ error: 'Database not configured' })
    }
    const body = request.body
    if (!body?.slug || !body?.name) {
      return reply.status(400).send({ error: 'slug and name required' })
    }
    const slug = normalizeTenantSlug(body.slug)
    if (!slug) {
      return reply.status(400).send({ error: 'Invalid slug: use only lowercase letters, numbers, and hyphens (1–64 chars)' })
    }
    const existingDb = await getTenantBySlug(slug)
    if (existingDb) {
      return reply.status(409).send({ error: 'Tenant slug already taken', slug })
    }
    const existingFile = await loadTenantBySlug(slug)
    if (existingFile) {
      return reply.status(409).send({ error: 'Tenant slug already taken', slug })
    }
    const id = body.id ?? slug
    const config: TenantConfig = {
      id,
      slug,
      name: body.name.trim(),
      description: body.description?.trim(),
      branding: body.branding ?? {},
      modules: normalizeModules(body.modules ?? [{ id: 'admin', enabled: true }]),
      admins: [wallet],
      treasury: body.treasury?.trim(),
    }
    await upsertTenant(config)
    const tenant = await getTenantBySlug(slug)
    return { tenant }
  })
}
