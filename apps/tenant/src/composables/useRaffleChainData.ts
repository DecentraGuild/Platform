import type { RaffleChainData } from '@decentraguild/web3'
import { fetchRaffleChainData } from '@decentraguild/web3'
import { useSolanaConnection } from '~/composables/useSolanaConnection'

export function useRaffleChainData() {
  const { connection } = useSolanaConnection()

  async function getChainData(rafflePubkey: string): Promise<RaffleChainData | null> {
    if (!connection.value) return null
    return fetchRaffleChainData(connection.value, rafflePubkey)
  }

  return {
    getChainData,
  }
}
