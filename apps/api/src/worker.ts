/**
 * Standalone worker process: runs Discord holder sync and module lifecycle on a schedule.
 * Run one instance when scaling (e.g. one container); API instances do not run these jobs.
 */

import './worker-env.js'
import { ensureConfigPaths } from './config/ensure-paths.js'
import {
  DEFAULT_DISCORD_SYNC_INTERVAL_MINUTES,
  DEFAULT_MODULE_LIFECYCLE_INTERVAL_MINUTES,
} from './config/constants.js'
import { initPool } from './db/client.js'
import { runMigrations } from './db/run-migrations.js'
import { syncAllLinkedGuilds } from './discord/holder-sync.js'
import { runDbBackup, isBackupConfigured } from './jobs/db-backup.js'
import { runModuleLifecycle } from './jobs/module-lifecycle.js'

const log = {
  info: (obj: unknown, msg?: string) => console.log(JSON.stringify({ level: 'info', ...(typeof obj === 'object' && obj !== null ? obj : {}), msg: msg ?? '' })),
  warn: (obj: unknown, msg?: string) => console.warn(JSON.stringify({ level: 'warn', ...(typeof obj === 'object' && obj !== null ? obj : {}), msg: msg ?? '' })),
  error: (obj: unknown, msg?: string) => console.error(JSON.stringify({ level: 'error', ...(typeof obj === 'object' && obj !== null ? obj : {}), msg: msg ?? '' })),
}

async function main(): Promise<void> {
  ensureConfigPaths()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log.warn({}, 'Worker requires DATABASE_URL; exiting')
    process.exit(1)
  }

  initPool(databaseUrl)
  await runMigrations(log)
  log.info({}, 'Worker migrations complete')

  const syncIntervalMinutes = Number(process.env.DISCORD_SYNC_INTERVAL_MINUTES ?? DEFAULT_DISCORD_SYNC_INTERVAL_MINUTES)
  if (syncIntervalMinutes > 0) {
    const runSync = () => {
      syncAllLinkedGuilds(log).catch((err) => log.error({ err }, 'Scheduled Discord holder sync failed'))
    }
    runSync()
    setInterval(runSync, syncIntervalMinutes * 60 * 1000)
    log.info({ intervalMinutes: syncIntervalMinutes }, 'Discord holder sync scheduled (on boot and every N min)')
  }

  const lifecycleIntervalMinutes = Number(process.env.MODULE_LIFECYCLE_INTERVAL_MINUTES ?? DEFAULT_MODULE_LIFECYCLE_INTERVAL_MINUTES)
  if (lifecycleIntervalMinutes > 0) {
    const runLifecycle = () => {
      runModuleLifecycle(log).catch((err) => log.error({ err }, 'Module lifecycle job failed'))
    }
    runLifecycle()
    setInterval(runLifecycle, lifecycleIntervalMinutes * 60 * 1000)
    log.info({ intervalMinutes: lifecycleIntervalMinutes }, 'Module lifecycle job scheduled (on boot and every N min)')
  }

  if (syncIntervalMinutes <= 0 && lifecycleIntervalMinutes <= 0) {
    log.warn({}, 'No job intervals configured (DISCORD_SYNC_INTERVAL_MINUTES, MODULE_LIFECYCLE_INTERVAL_MINUTES); worker idle')
  }

  const backupIntervalMs = 24 * 60 * 60 * 1000
  if (isBackupConfigured()) {
    const runBackup = () => runDbBackup(log).catch((err) => log.error({ err }, 'DB backup failed'))
    setTimeout(runBackup, 60 * 1000)
    setInterval(runBackup, backupIntervalMs)
    log.info({ intervalHours: 24 }, 'DB backup scheduled (first run in 1 min, then daily)')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
