import { PublicKey, SystemProgram, type Transaction } from '@solana/web3.js'
import { FEE_CONFIG, TRANSACTION_COSTS } from './constants.js'

export interface ShopFee {
  wallet: string
  makerFlatFee?: number
  takerFlatFee?: number
  makerPercentFee?: number
  takerPercentFee?: number
}

export function addMakerFeeInstructions(params: {
  maker: PublicKey
  shopFee: ShopFee | null
  transaction: Transaction
  tradeValue?: number
}): void {
  const { maker, shopFee, transaction, tradeValue = 0 } = params
  const platformFeeWallet = new PublicKey(FEE_CONFIG.WALLET)
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: maker,
      toPubkey: platformFeeWallet,
      lamports: FEE_CONFIG.MAKER_FEE_LAMPORTS,
    })
  )
  if (shopFee?.wallet) {
    let feeAmount = shopFee.makerFlatFee ?? 0
    if (shopFee.makerPercentFee && tradeValue > 0) {
      feeAmount += (tradeValue * shopFee.makerPercentFee) / 10000 // basis points
    }
    if (feeAmount > 0) {
      const lamports = Math.floor(feeAmount * 1_000_000_000)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: maker,
          toPubkey: new PublicKey(shopFee.wallet),
          lamports,
        })
      )
    }
  }
}

export function calculateTakerFee(shopFee: ShopFee | null, tradeValue = 0) {
  const basePlatformFee = TRANSACTION_COSTS.PLATFORM_TAKER_FEE
  const transactionFee = TRANSACTION_COSTS.TRANSACTION_FEE
  let shopTakerFee = 0
  if (shopFee?.wallet) {
    shopTakerFee = shopFee.takerFlatFee ?? 0
    if (shopFee.takerPercentFee && tradeValue > 0) {
      shopTakerFee += (tradeValue * shopFee.takerPercentFee) / 10000 // basis points
    }
  }
  return {
    platformFee: basePlatformFee,
    transactionFee,
    shopTakerFee,
    totalFee: basePlatformFee + transactionFee + shopTakerFee,
  }
}
