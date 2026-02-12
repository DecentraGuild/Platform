import type { FastifyInstance } from 'fastify'
import { loadTenantConfig } from '@decentraguild/core'
import { getPool } from '../db/client.js'
import { getTenantBySlug, updateTenant } from '../db/tenant.js'
import type { TenantConfig } from '@decentraguild/core'
import { getWalletFromRequest } from './auth.js'

async function requireTenantAdmin(
  request: Parameters<Parameters<FastifyInstance['get']>[1]>[0],
  reply: Parameters<Parameters<FastifyInstance['get']>[1]>[1],
  slug: string
): Promise<{ wallet: string; tenant: TenantConfig } | null> {
  const wallet = await getWalletFromRequest(request)
  if (!wallet) {
    reply.status(401).send({ error: 'Authentication required' })
    return null
  }
  let tenant: TenantConfig | null = null
  if (getPool()) tenant = await getTenantBySlug(slug)
  if (!tenant) tenant = await loadTenantConfig(slug)
  if (!tenant) {
    reply.status(404).send({ error: 'Tenant not found' })
    return null
  }
  const admins = tenant.admins ?? []
  if (!admins.includes(wallet)) {
    reply.status(403).send({ error: 'Admin access required' })
    return null
  }
  return { wallet, tenant }
}

export async function registerTenantSettingsRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/api/v1/tenant/:slug/settings', async (request, reply) => {
    const { slug } = request.params
    const result = await requireTenantAdmin(request, reply, slug)
    if (!result) return
    return { tenant: result.tenant }
  })

  app.patch<{
    Params: { slug: string }
    Body: Partial<{ name: string; description: string; branding: Partial<TenantConfig['branding']>; modules: TenantConfig['modules'] }>
  }>('/api/v1/tenant/:slug/settings', async (request, reply) => {
    const { slug } = request.params
    const result = await requireTenantAdmin(request, reply, slug)
    if (!result) return
    if (!getPool()) {
      return reply.status(503).send({ error: 'Database not configured' })
    }
    const body = request.body ?? {}
    const updated = await updateTenant(slug, body)
    if (!updated) {
      return reply.status(404).send({ error: 'Tenant not found' })
    }
    return { tenant: updated }
  })
}
