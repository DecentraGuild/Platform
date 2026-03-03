import type { ConditionSet } from '@decentraguild/billing'
import { extractMarketplaceConditions } from './extractors/marketplace.js'
import { extractDiscordConditions } from './extractors/discord.js'
import { extractWhitelistConditions } from './extractors/whitelist.js'
import { extractRaffleConditions } from './extractors/raffles.js'

type Extractor = (tenantId: string) => Promise<ConditionSet>

const extractors: Record<string, Extractor> = {
  marketplace: extractMarketplaceConditions,
  discord: extractDiscordConditions,
  whitelist: extractWhitelistConditions,
  raffles: extractRaffleConditions,
  slug: async () => ({}),
}

/** Resolve live conditions for a billable module from tenant config/DB. */
export async function getConditions(moduleId: string, tenantId: string): Promise<ConditionSet> {
  const extractor = extractors[moduleId]
  if (!extractor) return {}
  return extractor(tenantId)
}
