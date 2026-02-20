/**
 * DAS (Digital Asset Standard) RPC types.
 * Shared across modules for Solana asset metadata.
 */

export interface DasAttribute {
  trait_type?: string
  value?: string | number
  display_type?: string
}

export interface DasAsset {
  id?: string
  interface?: string
  content?: {
    metadata?: {
      name?: string
      symbol?: string
      attributes?: DasAttribute[]
      seller_fee_basis_points?: number
    }
    links?: { image?: string }
  }
  grouping?: Array<{ group_key?: string; group_value?: string }>
  token_info?: { decimals?: number }
}
