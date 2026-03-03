import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { RAFFLE_PROGRAM_ID, RAFFLE_IDL } from '@decentraguild/contracts'
import type { Wallet } from '../escrow/types.js'

function getIdlWithAddress(): Record<string, unknown> {
  const idl = JSON.parse(JSON.stringify(RAFFLE_IDL)) as Record<string, unknown>
  idl.address = RAFFLE_PROGRAM_ID
  if (idl.types && Array.isArray(idl.types) && idl.types.length === 0) {
    delete idl.types
  }
  return idl
}

export function getRaffleProgram(connection: Connection, wallet: Wallet): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const programId = new PublicKey(RAFFLE_PROGRAM_ID)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(getIdlWithAddress() as any, programId, provider)
}

export function getRaffleProgramReadOnly(connection: Connection): Program {
  const dummyWallet: Wallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  }
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const programId = new PublicKey(RAFFLE_PROGRAM_ID)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(getIdlWithAddress() as any, programId, provider)
}
