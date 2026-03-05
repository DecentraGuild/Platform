/**
 * Worker process: runs scheduled jobs (module lifecycle). Discord holder sync runs in the
 * standalone Discord bot repo; this worker only runs API-side jobs.
 */

import 'dotenv/config'
import { ensureConfigPaths } from './config/ensure-paths.js'
import { initPool } from './db/client.js'
import { runModuleLifecycle } from './jobs/module-lifecycle.js'
import {
  DEFAULT_MODULE_LIFECYCLE_INTERVAL_MINUTES,
} from './config/constants.js'

ensureConfigPaths()

const log = {
  info: (obj: unknown, msg?: string) => console.log('[worker]', msg ?? '', typeof obj === 'object' && obj !== null ? obj : {}),
  warn: (obj: unknown, msg?: string) => console.warn('[worker]', msg ?? '', typeof obj === 'object' && obj !== null ? obj : {}),
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    initPool(databaseUrl)
    log.info({}, 'Worker: database pool initialized')
  } else {
    log.warn({}, 'Worker: DATABASE_URL not set; module lifecycle will use file config only')
  }

  const intervalMinutes = Number(process.env.MODULE_LIFECYCLE_INTERVAL_MINUTES ?? DEFAULT_MODULE_LIFECYCLE_INTERVAL_MINUTES)

  if (intervalMinutes > 0) {
    const intervalMs = intervalMinutes * 60 * 1000
    await runModuleLifecycle(log)
    setInterval(() => void runModuleLifecycle(log), intervalMs)
    log.info({ intervalMinutes }, 'Worker: module lifecycle scheduled')
  } else {
    log.info({}, 'Worker: module lifecycle disabled (MODULE_LIFECYCLE_INTERVAL_MINUTES=0); process staying alive')
    setInterval(() => {}, 60_000)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
