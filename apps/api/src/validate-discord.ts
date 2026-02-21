/**
 * Validation for Discord and Solana IDs used in Discord module.
 */

const DISCORD_SNOWFLAKE_REGEX = /^\d{17,20}$/
const MINT_MAX_LEN = 64
const MINT_MIN_LEN = 32

export function isValidDiscordSnowflake(id: string): boolean {
  return typeof id === 'string' && DISCORD_SNOWFLAKE_REGEX.test(id.trim())
}

export function isValidMintOrGroup(id: string): boolean {
  if (typeof id !== 'string') return false
  const s = id.trim()
  return s.length >= MINT_MIN_LEN && s.length <= MINT_MAX_LEN && !s.includes('\0')
}
