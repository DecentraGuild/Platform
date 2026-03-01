import type { FastifyInstance } from 'fastify'
import { type TenantConfig } from '@decentraguild/core'
import { getPool, query } from '../db/client.js'
import { rowToTenantConfig } from '../db/tenant.js'
import { listTenantSlugs, loadTenantByIdOrSlug } from '../config/registry.js'

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

  // Tenant creation is via paid registration (POST /api/v1/register/intent + confirm).
}
