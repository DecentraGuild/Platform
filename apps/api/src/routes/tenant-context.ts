import type { FastifyInstance } from 'fastify'
import { getTenantSlugFromHost } from '@decentraguild/core'
import type { TenantConfigDiagnostic } from '../config/registry.js'
import { loadTenantBySlug, loadTenantBySlugDiagnostic } from '../config/registry.js'
import { getPool } from '../db/client.js'
import { getTenantBySlug } from '../db/tenant.js'

export async function registerTenantContextRoutes(app: FastifyInstance) {
  app.get('/api/v1/tenant-context', async (request, reply) => {
    const { searchParams } = new URL(request.url, 'http://localhost')
    const slugParam = searchParams.get('slug')
    const host = request.headers.host ?? ''
    const debug = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true'

    const slug = slugParam ?? getTenantSlugFromHost(host, searchParams)

    if (!slug) {
      return reply.status(404).send({ error: 'Tenant slug required' })
    }

    let tenant = null
    if (getPool()) {
      try {
        tenant = await getTenantBySlug(slug)
      } catch {
        // DB not available or query failed
      }
    }
    if (!tenant) tenant = await loadTenantBySlug(slug)
    if (!tenant) {
      const body: { error: string; diagnostic?: TenantConfigDiagnostic } = {
        error: 'Tenant not found',
      }
      if (debug) body.diagnostic = await loadTenantBySlugDiagnostic(slug)
      return reply.status(404).send(body)
    }

    return { tenant }
  })
}
