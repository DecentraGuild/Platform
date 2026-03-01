/**
 * Daily DB backup: pg_dump to Cloudflare R2 (S3-compatible).
 * Requires pg_dump (postgresql-client) in the environment.
 * Env: BACKUP_BUCKET, BACKUP_ACCESS_KEY_ID, BACKUP_SECRET_ACCESS_KEY, BACKUP_ENDPOINT.
 */

import { spawn } from 'node:child_process'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

type Log = { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void }

export function isBackupConfigured(): boolean {
  return Boolean(
    process.env.BACKUP_BUCKET &&
      process.env.BACKUP_ACCESS_KEY_ID &&
      process.env.BACKUP_SECRET_ACCESS_KEY &&
      process.env.BACKUP_ENDPOINT
  )
}

export async function runDbBackup(log: Log): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log.warn({}, 'DB backup skipped: DATABASE_URL not set')
    return
  }

  if (!isBackupConfigured()) {
    log.warn({}, 'DB backup skipped: BACKUP_BUCKET, BACKUP_ACCESS_KEY_ID, BACKUP_SECRET_ACCESS_KEY, BACKUP_ENDPOINT required')
    return
  }

  const date = new Date().toISOString().slice(0, 10)
  const key = `backups/db-${date}.dump`

  return new Promise((resolve) => {
    let spawnFailed = false
    const proc = spawn('pg_dump', ['-Fc', '-f', '-', databaseUrl], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const chunks: Buffer[] = []
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))

    proc.stderr.on('data', (data: Buffer) => {
      log.warn({ stderr: data.toString().trim() }, 'pg_dump stderr')
    })

    proc.on('error', (err) => {
      spawnFailed = true
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        log.warn(
          {},
          'DB backup skipped: pg_dump not found (expected locally on Windows; runs on Railway with nixpacks postgresql)'
        )
      } else {
        log.error({ err }, 'DB backup failed: pg_dump error')
      }
      resolve()
    })

    proc.on('close', async (code, signal) => {
      if (spawnFailed) return
      if (code !== 0) {
        log.error({ code, signal }, 'DB backup failed: pg_dump exited with error')
        resolve()
        return
      }

      const body = Buffer.concat(chunks)
      const sizeMb = (body.length / 1024 / 1024).toFixed(2)

      try {
        const client = new S3Client({
          region: 'auto',
          endpoint: process.env.BACKUP_ENDPOINT,
          credentials: {
            accessKeyId: process.env.BACKUP_ACCESS_KEY_ID!,
            secretAccessKey: process.env.BACKUP_SECRET_ACCESS_KEY!,
          },
          forcePathStyle: true,
        })

        await client.send(
          new PutObjectCommand({
            Bucket: process.env.BACKUP_BUCKET,
            Key: key,
            Body: body,
            ContentType: 'application/octet-stream',
          })
        )

        log.info({ key, sizeMb }, 'DB backup uploaded to R2')
      } catch (err) {
        log.error({ err, key }, 'DB backup upload failed')
      }
      resolve()
    })
  })
}
