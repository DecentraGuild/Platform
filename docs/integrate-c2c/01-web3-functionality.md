# C2C Reference: Web3 Functionality and RPC Calls

Extracted from `_integrate/C2C` for use when implementing in DecentraGuild. Do not edit `_integrate`; implement in `packages/web3`, `packages/contracts`, and related apps.

---

## Program and Network

| Constant | Value |
|----------|-------|
| Escrow Program ID | `esccxeEDYUXQaeMwq1ZwWAvJaHVYfsXNva13JYb2Chs` |
| Whitelist Program ID | `whi5uDPWK4rAE9Sus6hdxdHwsG1hjDBn6kXM6pyqwTn` |
| Contract Fee Account | `feeLpAUDSsYBMwpxvVr5hwwDQE32BcWXRfAd3A6agWx` |
| Platform Fee Wallet | `HP5t6d24hgtcP7r1HxKQM8Nu471gqu7A2UJ5HoAESTPv` |
| Network | Mainnet (primary); Devnet supported |

---

## RPC and Connection

- **Primary RPC**: Helius `https://mainnet.helius-rpc.com/?api-key={API_KEY}`
- **Fallback**: `https://api.mainnet-beta.solana.com`
- **Environment**: `VITE_HELIUS_API_KEY` (required in production)

Connection singleton pattern:

```js
// useSolanaConnection.js pattern
let connectionInstance = null
let currentNetwork = null

// Returns Connection with commitment: 'confirmed', confirmTransactionInitialTimeout: 60000
export function useSolanaConnection(network = ACTIVE_NETWORK, commitment = 'confirmed') {
  if (connectionInstance && currentNetwork === network) return connectionInstance
  const rpcUrl = RPC_ENDPOINTS[network]?.primary
  connectionInstance = new Connection(rpcUrl, { commitment, confirmTransactionInitialTimeout: 60000 })
  currentNetwork = network
  return connectionInstance
}
```

---

## Dependencies (Solana stack)

- `@solana/web3.js` – Connection, Transaction, PublicKey, SystemProgram
- `@solana/spl-token` – getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
- `@coral-xyz/anchor` – Program, AnchorProvider, BN
- `solana-wallets-vue` – useWallet, useAnchorWallet

---

## Helius APIs

### DAS (Digital Asset Standard)

**getAssetsByOwner**

- Method: `getAssetsByOwner`
- Pagination: `page`, `limit` (1000)
- Returns: NFTs, fungibles, Token-2022, compressed NFTs
- Used for: full wallet balances (industry standard: Tensor, etc. use DAS)

```js
const body = {
  jsonrpc: '2.0',
  id: 'helius-das-assets-by-owner',
  method: 'getAssetsByOwner',
  params: { ownerAddress, page, limit }
}
// POST to helius-rpc.com
```

**getAssetsByGroup**

- Method: `getAssetsByGroup`
- Params: `groupKey: 'collection'`, `groupValue: collectionMint`, `page`, `limit`
- Used for: fetching collection NFTs

**searchAssets**

- Fallback for creator-based NFT fetch when REST `/mints?creator=` fails

**getAsset**

- Single asset by mint (id param)

### Helius REST API

- Base: `https://api.helius.xyz/v0` (mainnet) / `https://api-devnet.helius.xyz/v0` (devnet)
- `GET /addresses/{walletAddress}/nfts?api-key={key}` – wallet NFTs

---

## Wallet Balance Fetch Strategy

1. **SOL**: `connection.getBalance(walletPubkey)` → lamports / 1e9
2. **SPL Tokens**:
   - DAS `getAssetsByOwner` and legacy RPC in parallel
   - Legacy RPC: `getParsedTokenAccountsByOwner` for `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`
   - Merge by mint: RPC authoritative for balance; DAS used for metadata when missing

---

## Escrow Transaction Flow

### Anchor Program (Read-only instance)

```js
const dummyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs
}
const provider = new AnchorProvider(connection, dummyWallet, {
  commitment: 'confirmed',
  preflightCommitment: 'confirmed'
})
return new Program(idlWithAddress, programIdPubkey, provider)
```

### PDA Derivation

```js
// Escrow PDA: ["escrow", maker.toBuffer(), seed.toArrayLike(Buffer).reverse()]
const [escrow] = PublicKey.findProgramAddressSync(
  [Buffer.from('escrow'), maker.toBuffer(), seed.toArrayLike(Buffer).reverse()],
  programId
)
// Auth: ["auth", escrow.toBuffer()]
// Vault: ["vault", escrow.toBuffer()]
```

### Initialize Escrow

- Memo instruction (optional, for wallet display)
- ATA creation for maker deposit and request tokens if missing
- Maker fee instructions (platform + optional shop)
- `program.methods.initialize(seedBN, depositAmountBN, requestAmountBN, expireTimestampBN, allowPartialFill, onlyWhitelist, slippage).accounts(...).instruction()`

Recipient: `null` for public escrows; actual address for direct escrows.

### Exchange (Fill)

- `prepareTakerATAs`: check/create taker’s ATAs for request and deposit
- Wrapped SOL: wrap native SOL if request token is wSOL
- `program.methods.exchange(amountBN).accounts(...).instruction()`

### Cancel

- `program.methods.cancel().accounts(...).instruction()`

---

## Fee Handling

| Fee | Amount (SOL) | Lamports |
|-----|--------------|----------|
| Maker (platform) | 0.001 | 1,000,000 |
| Taker (platform) | 0.0006 | 600,000 |
| ATA creation | 0.0022 | per ATA |
| Transaction fee | 0.0006 | estimate |

Shop fees: `{ wallet, makerFlatFee, takerFlatFee, makerPercentFee, takerPercentFee }` – added as extra SOL transfer instructions before/alongside escrow instruction.

---

## Token Program Detection

- Reject Token-2022 and MPL Core for escrow (only legacy SPL supported)
- `getTokenProgramIdForMint(connection, mint, context)` checks mint owner; throws if not legacy SPL

---

## Wrapped SOL

- Mint: `So11111111111111111111111111111111111111112`
- When request token is wSOL: taker must wrap native SOL; add create + transfer instructions

---

## Timeouts and Limits

| Constant | Value |
|----------|-------|
| RPC_ESCROW_FETCH_TIMEOUT_MS | 25000 |
| RPC_BALANCE_FETCH_TIMEOUT_MS | 25000 |
| BALANCE_CACHE_TTL_MS | 60000 |
| DAS_PAGE_LIMIT | 1000 |
| NFT_FETCH_LIMIT | 10000 |

---

## NFT Format (normalized from Helius/DAS)

```js
{
  mint: string,
  name: string,
  symbol: string,
  image: string | null,
  decimals: 0,
  balance: 1,
  balanceRaw: '1',
  uri: string | null,
  isCollectionItem: true,
  fetchingType: 'NFT',
  attributes: [],
  collection: string | null  // collection mint
}
```

---

## Balance Format (after dasAssetToBalance / merge)

```js
{
  mint: string,
  symbol: string | null,
  name: string | null,
  decimals: number,
  balance: number,
  balanceRaw: string,
  isNative: boolean,
  image?: string | null
}
```
