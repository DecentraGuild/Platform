import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import { deriveTicketsPda } from './accounts.js'

export type RaffleState =
  | 'created'
  | 'ready'
  | 'running'
  | 'paused'
  | 'full'
  | 'claimprize'
  | 'claimtickets'
  | 'done'

export interface RaffleChainData {
  state: RaffleState
  stateDisplay: string
  ticketsSold: number
  ticketsTotal: number
  ticketMint: string
  ticketPrice: bigint
  ticketDecimals: number
  prizeMint: string
  winner: string | null
  useWhitelist: boolean
  whitelist: string | null
  name: string
  description: string
  url: string
}

const STATE_DISPLAY: Record<RaffleState, string> = {
  created: 'Created',
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  full: 'Full',
  claimprize: 'Claim Prize',
  claimtickets: 'Claim Tickets',
  done: 'Done',
}

const STATE_NAMES = ['created', 'ready', 'running', 'paused', 'full', 'claimprize', 'claimtickets', 'done'] as const

function toStateDisplay(state: RaffleState): string {
  return STATE_DISPLAY[state] ?? state
}

function readBorshString(data: Buffer, offset: number): { value: string; bytesRead: number } {
  const len = data.readUInt32LE(offset)
  const value = data.subarray(offset + 4, offset + 4 + len).toString('utf8')
  return { value, bytesRead: 4 + len }
}

function parseRaffleRaw(data: Buffer): {
  state: RaffleState
  name: string
  description: string
  url: string
  ticketMint: string
  ticketPrice: bigint
  ticketDecimals: number
  prizeMint: string
  winner: string | null
  useWhitelist: boolean
  whitelist: string | null
} | null {
  if (data.length < 8) return null
  let o = 8 // skip discriminator
  if (o + 8 + 1 + 32 + 1 > data.length) return null
  o += 8 // seed
  o += 1 // bump
  o += 32 // creator
  const stateIdx = data[o]
  o += 1
  const state = (STATE_NAMES[stateIdx] ?? 'created') as RaffleState
  const nameRes = readBorshString(data, o)
  o += nameRes.bytesRead
  const descRes = readBorshString(data, o)
  o += descRes.bytesRead
  const urlRes = readBorshString(data, o)
  o += urlRes.bytesRead
  if (o + 32 + 8 + 1 + 32 + 8 + 1 + 32 + 32 > data.length) return null
  const ticketMint = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  const ticketPrice = data.readBigUInt64LE(o)
  o += 8
  const ticketDecimals = data[o]
  o += 1
  const prizeMint = new PublicKey(data.subarray(o, o + 32)).toBase58()
  o += 32
  o += 8 // prizeVaultCount (u64)
  o += 1 // prizeDecimals (u8)
  o += 32 // tickets (pubkey)
  const winnerBytes = data.subarray(o, o + 32)
  const winner = winnerBytes.every((b) => b === 0) ? null : new PublicKey(winnerBytes).toBase58()
  o += 32
  if (o + 1 + 1 + 32 > data.length) return { state, name: nameRes.value, description: descRes.value, url: urlRes.value, ticketMint, ticketPrice, ticketDecimals, prizeMint, winner, useWhitelist: false, whitelist: null }
  const randomnessOpt = data[o]
  o += 1
  if (randomnessOpt !== 0) o += 32
  const useWhitelist = data[o] !== 0
  o += 1
  const whitelistBytes = data.subarray(o, o + 32)
  const whitelist = whitelistBytes.every((b) => b === 0) ? null : new PublicKey(whitelistBytes).toBase58()
  return { state, name: nameRes.value, description: descRes.value, url: urlRes.value, ticketMint, ticketPrice, ticketDecimals, prizeMint, winner, useWhitelist, whitelist }
}

export async function fetchRaffleChainData(
  connection: Connection,
  rafflePubkey: PublicKey | string
): Promise<RaffleChainData | null> {
  const pubkey = typeof rafflePubkey === 'string' ? new PublicKey(rafflePubkey) : rafflePubkey
  try {
    const [raffleInfo, ticketsInfo] = await Promise.all([
      connection.getAccountInfo(pubkey),
      connection.getAccountInfo(deriveTicketsPda(pubkey)),
    ])
    if (!raffleInfo?.data) return null
    const parsed = parseRaffleRaw(Buffer.from(raffleInfo.data))
    if (!parsed) return null
    let ticketsSold = 0
    let ticketsTotal = 0
    if (ticketsInfo?.data && ticketsInfo.data.length >= 12) {
      ticketsSold = ticketsInfo.data.readUInt32LE(8)
      ticketsTotal = ticketsInfo.data.readUInt32LE(12)
    }
    return {
      state: parsed.state,
      stateDisplay: toStateDisplay(parsed.state),
      ticketsSold,
      ticketsTotal,
      ticketMint: parsed.ticketMint,
      ticketPrice: parsed.ticketPrice,
      ticketDecimals: parsed.ticketDecimals,
      prizeMint: parsed.prizeMint,
      winner: parsed.winner,
      useWhitelist: parsed.useWhitelist,
      whitelist: parsed.whitelist,
      name: parsed.name,
      description: parsed.description,
      url: parsed.url,
    }
  } catch {
    return null
  }
}

/** States visible to end users (running and after). */
export const USER_VISIBLE_STATES: RaffleState[] = [
  'running',
  'full',
  'claimprize',
  'claimtickets',
  'done',
]

export function isRaffleVisibleToUsers(state: RaffleState): boolean {
  return USER_VISIBLE_STATES.includes(state)
}
