import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { ESCROW_PROGRAM_ID, ESCROW_IDL } from '@decentraguild/contracts'
import type { Wallet } from './types.js'

function getIdlWithAddress(): Record<string, unknown> {
  const idl = JSON.parse(JSON.stringify(ESCROW_IDL)) as Record<string, unknown>
  idl.address = ESCROW_PROGRAM_ID
  if (idl.types && Array.isArray(idl.types) && idl.types.length === 0) {
    delete idl.types
  }
  return idl
}

export function getEscrowProgram(connection: Connection, wallet: Wallet): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const programId = new PublicKey(ESCROW_PROGRAM_ID)
  return new Program(getIdlWithAddress() as Parameters<typeof Program.at>[0], programId, provider)
}

export function getEscrowProgramReadOnly(connection: Connection): Program {
  const dummyWallet: Wallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  }
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const programId = new PublicKey(ESCROW_PROGRAM_ID)
  return new Program(getIdlWithAddress() as Parameters<typeof Program.at>[0], programId, provider)
}
