/**
 * Shared Solana RPC connection for DAS and chain reads.
 * Uses getDasRpcUrl() (Helius DAS or fallback RPC). Reuse instead of creating Connection per request.
 */

import { Connection } from '@solana/web3.js'
import { getDasRpcUrl } from '@decentraguild/web3'

let connection: Connection | null = null

export function getSolanaConnection(): Connection {
  if (!connection) {
    connection = new Connection(getDasRpcUrl())
  }
  return connection
}
