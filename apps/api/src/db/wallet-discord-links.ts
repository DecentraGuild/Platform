import { query } from './client.js'

export interface WalletDiscordLinkRow {
  wallet_address: string
  discord_user_id: string
  linked_at: string
  created_at: string
}

export async function getLinkByWallet(walletAddress: string): Promise<WalletDiscordLinkRow | null> {
  const { rows } = await query<WalletDiscordLinkRow>(
    'SELECT * FROM wallet_discord_links WHERE wallet_address = $1',
    [walletAddress]
  )
  return rows[0] ?? null
}

export async function getWalletsByDiscordUserId(discordUserId: string): Promise<string[]> {
  const { rows } = await query<{ wallet_address: string }>(
    'SELECT wallet_address FROM wallet_discord_links WHERE discord_user_id = $1',
    [discordUserId]
  )
  return rows.map((r) => r.wallet_address)
}

/** All wallet-discord links. Group by discord_user_id in memory for batched eligibility. */
export async function getAllWalletLinks(): Promise<Array<{ wallet_address: string; discord_user_id: string }>> {
  const { rows } = await query<{ wallet_address: string; discord_user_id: string }>(
    'SELECT wallet_address, discord_user_id FROM wallet_discord_links'
  )
  return rows
}

export async function linkWalletToDiscord(walletAddress: string, discordUserId: string): Promise<WalletDiscordLinkRow> {
  await query(
    `INSERT INTO wallet_discord_links (wallet_address, discord_user_id, linked_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (wallet_address) DO UPDATE SET
       discord_user_id = EXCLUDED.discord_user_id,
       linked_at = NOW()`,
    [walletAddress, discordUserId]
  )
  const row = await getLinkByWallet(walletAddress)
  if (!row) throw new Error('Failed to read back wallet_discord_links row')
  return row
}

/** Remove link for this wallet. Returns true if a row was deleted. */
export async function revokeWalletLink(walletAddress: string): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM wallet_discord_links WHERE wallet_address = $1',
    [walletAddress]
  )
  return (rowCount ?? 0) > 0
}

/** If wallet is already linked to a different Discord user, returns that user id; otherwise null. */
export async function getDiscordUserIdForWallet(walletAddress: string): Promise<string | null> {
  const row = await getLinkByWallet(walletAddress)
  return row?.discord_user_id ?? null
}
