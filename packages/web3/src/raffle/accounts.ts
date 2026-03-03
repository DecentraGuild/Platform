import { PublicKey } from '@solana/web3.js'
import { RAFFLE_PROGRAM_ID } from '@decentraguild/contracts'

/**
 * Derive the raffle account PDA.
 * Seeds: ["raffle", seed] per DDD_live and program (rafxXxjw9fkAuQhCJ1A4gmX1oqgvRrSeXyRPUE9K2Yx).
 * Program expects u64 seed as LE bytes. Our seed is 8 bytes LE from writeBigUInt64LE.
 */
export function deriveRafflePda(
  _name: string,
  seed: Uint8Array | Buffer,
  programId: PublicKey | string = RAFFLE_PROGRAM_ID
): PublicKey {
  const progId = typeof programId === 'string' ? new PublicKey(programId) : programId
  const seedBuf = Buffer.isBuffer(seed) ? Buffer.from(seed) : Buffer.from(seed)
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('raffle', 'utf8'), seedBuf],
    progId
  )
  return pda
}

/**
 * Derive the tickets account PDA for a raffle.
 * Seeds: ["tickets", raffle] per reference program.
 */
export function deriveTicketsPda(
  raffle: PublicKey,
  programId: PublicKey | string = RAFFLE_PROGRAM_ID
): PublicKey {
  const progId = typeof programId === 'string' ? new PublicKey(programId) : programId
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('tickets', 'utf8'), raffle.toBuffer()],
    progId
  )
  return pda
}

/**
 * Derive the ticket vault PDA for a raffle (holds ticket-mint tokens from buyers).
 * Seeds: ["vaultTickets", raffle] per reference program.
 */
export function deriveTicketVaultPda(
  raffle: PublicKey,
  programId: PublicKey | string = RAFFLE_PROGRAM_ID
): PublicKey {
  const progId = typeof programId === 'string' ? new PublicKey(programId) : programId
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vaultTickets', 'utf8'), raffle.toBuffer()],
    progId
  )
  return pda
}

/**
 * Derive the prize vault PDA for a raffle.
 * Seeds: ["vaultPrize", raffle] per DDD_live raffleConfig.
 */
export function derivePrizeVaultPda(
  raffle: PublicKey,
  programId: PublicKey | string = RAFFLE_PROGRAM_ID
): PublicKey {
  const progId = typeof programId === 'string' ? new PublicKey(programId) : programId
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vaultPrize', 'utf8'), raffle.toBuffer()],
    progId
  )
  return pda
}
