import type { ConditionSet } from '@decentraguild/billing'
import { countActiveRaffles } from '../../db/raffle.js'

export async function extractRaffleConditions(tenantId: string): Promise<ConditionSet> {
  const count = await countActiveRaffles(tenantId)
  return { raffleSlotsUsed: count }
}
