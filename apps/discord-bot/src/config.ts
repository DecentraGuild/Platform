/**
 * Bot config from env. Validated at startup where required.
 */

export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001'
export const DISCORD_BOT_API_SECRET = process.env.DISCORD_BOT_API_SECRET
const VERIFY_URL_TEMPLATE = process.env.VERIFY_URL_TEMPLATE ?? 'https://{{slug}}.dguild.org/verify?token={{token}}'

export function buildVerifyUrl(tenantSlug: string, token: string): string {
  return VERIFY_URL_TEMPLATE
    .replace(/\{\{\s*slug\s*\}\}/gi, encodeURIComponent(tenantSlug))
    .replace(/\{\{\s*token\s*\}\}/gi, encodeURIComponent(token))
}

export const ROLE_SYNC_INTERVAL_MS = 15 * 60 * 1000
