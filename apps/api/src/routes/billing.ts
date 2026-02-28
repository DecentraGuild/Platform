import type { FastifyInstance } from 'fastify'
import type { ConditionSet, BillingPeriod } from '@decentraguild/billing'
import { computePrice } from '@decentraguild/billing'
import { getModuleCatalogEntry } from '@decentraguild/config'
import { getConditions } from '../billing/conditions.js'
import { requireTenantAdmin } from './tenant-settings.js'
import { apiError, ErrorCode } from '../api-errors.js'

const VALID_BILLING_PERIODS: ReadonlySet<string> = new Set(['monthly', 'yearly'])

export async function registerBillingRoutes(app: FastifyInstance) {
  app.get<{
    Params: { slug: string }
    Querystring: { moduleId?: string; billingPeriod?: string }
  }>('/api/v1/tenant/:slug/billing/price-preview', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return

    const moduleId = request.query.moduleId
    if (!moduleId) {
      return reply.status(400).send(apiError('moduleId query parameter is required', ErrorCode.BAD_REQUEST))
    }

    const catalogEntry = getModuleCatalogEntry(moduleId)
    if (!catalogEntry) {
      return reply.status(404).send(apiError('Module not found in catalog', ErrorCode.NOT_FOUND))
    }

    const billingPeriod = request.query.billingPeriod
    if (billingPeriod && !VALID_BILLING_PERIODS.has(billingPeriod)) {
      return reply.status(400).send(apiError('billingPeriod must be "monthly" or "yearly"', ErrorCode.BAD_REQUEST))
    }

    const tenantId = result.tenant.id
    const conditions = await getConditions(moduleId, tenantId)
    const price = computePrice(moduleId, conditions, catalogEntry.pricing, {
      billingPeriod: (billingPeriod as BillingPeriod) ?? 'monthly',
    })

    return { conditions, price }
  })

  app.post<{
    Params: { slug: string }
    Body: { moduleId: string; conditions?: ConditionSet; billingPeriod?: BillingPeriod }
  }>('/api/v1/tenant/:slug/billing/price-preview', async (request, reply) => {
    const result = await requireTenantAdmin(request, reply, request.params.slug)
    if (!result) return

    const body = request.body ?? {} as Record<string, unknown>
    const moduleId = body.moduleId
    if (!moduleId || typeof moduleId !== 'string') {
      return reply.status(400).send(apiError('moduleId is required', ErrorCode.BAD_REQUEST))
    }

    const catalogEntry = getModuleCatalogEntry(moduleId)
    if (!catalogEntry) {
      return reply.status(404).send(apiError('Module not found in catalog', ErrorCode.NOT_FOUND))
    }

    const billingPeriod = body.billingPeriod
    if (billingPeriod && !VALID_BILLING_PERIODS.has(billingPeriod)) {
      return reply.status(400).send(apiError('billingPeriod must be "monthly" or "yearly"', ErrorCode.BAD_REQUEST))
    }

    const tenantId = result.tenant.id
    const conditions: ConditionSet = body.conditions && typeof body.conditions === 'object'
      ? body.conditions
      : await getConditions(moduleId, tenantId)

    const price = computePrice(moduleId, conditions, catalogEntry.pricing, {
      billingPeriod: billingPeriod ?? 'monthly',
    })

    return { conditions, price }
  })
}
