/**
 * Truncates all tenant and application data. Use for MVP reset.
 * Requires DATABASE_URL. Run: pnpm run db:clear (from apps/api)
 */

import 'dotenv/config'
import { initPool } from '../src/db/client.js'

const TABLES = [
  'billing_payments',
  'billing_subscriptions',
  'marketplace_mint_scope',
  'marketplace_settings',
  'discord_guild_mints',
  'discord_guild_roles',
  'discord_role_conditions',
  'discord_role_rules',
  'discord_holder_snapshots',
  'discord_audit_log',
  'discord_role_removal_queue',
  'discord_verify_sessions',
  'discord_servers',
  'wallet_discord_links',
  'mint_metadata',
  'tenant_config',
  'auth_nonce',
] as const

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is required. Set it in .env or environment.')
    process.exit(1)
  }

  const pool = initPool(url)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`)
    await client.query('COMMIT')
    console.log('Database cleared.')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
