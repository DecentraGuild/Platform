import type { FastifyInstance } from 'fastify'
import type { TenantConfig } from '@decentraguild/core'
import { getPool, query } from '../db/client.js'
import { getTenantBySlug, rowToTenantConfig, upsertTenant } from '../db/tenant.js'
import { getWalletFromRequest } from './auth.js'
import { listTenantSlugs, loadTenantBySlug } from '../config/registry.js'

export async function registerTenantsRoutes(app: FastifyInstance) {
  app.get('/api/v1/tenants', async (_request, reply) => {
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
    const id = body.id ?? body.slug
    const config: TenantConfig = {
      id,
      slug: body.slug,
      name: body.name,
      description: body.description,
      branding: body.branding ?? {},
      modules: body.modules ?? [{ id: 'admin', enabled: true }],
      admins: [wallet],
      treasury: body.treasury,
    }
    await upsertTenant(config)
    const tenant = await getTenantBySlug(body.slug)
    return { tenant }
  })
}
