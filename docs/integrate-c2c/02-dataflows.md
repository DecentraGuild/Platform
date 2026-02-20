# C2C Reference: Dataflows – Displaying and Usage

Extracted from `_integrate/C2C` for use when implementing in DecentraGuild. Describes how data flows through stores, composables, and display logic.

---

## Store Overview

| Store | Purpose |
|-------|---------|
| wallet | Read-only: connected, publicKey, isWalletReady; uses solana-wallets-vue |
| escrow | Escrows from chain (load replaces list); errors for transaction/network/escrows/form |
| escrowForm | Form state for create-escrow (separate from escrow list) |
| storefront | Storefronts (tenants) from registry + per-storefront config |
| storefrontMetadata | Cached NFTs per storefront for offer/request selectors |
| theme | Theme config (colors, fonts, branding) |
| token | Token metadata cache (name, symbol, decimals, image) |
| walletBalance | Wallet balances (SOL + SPL); managed by useWalletBalances composable |

---

## Escrow Store Dataflow

1. `loadEscrows(makerPublicKey)` → `fetchAllEscrows(connection, makerFilter)` (RPC)
2. Raw escrows processed in batches (BATCH_SIZES.ESCROW_PROCESSING = 20)
3. For each escrow: `tokenStore.fetchTokenInfo(depositMint)`, `tokenStore.fetchTokenInfo(requestMint)`
4. `formatEscrowData(escrowData, depositTokenInfo, requestTokenInfo)` → formatted escrow
5. Status: `calculateEscrowStatus(escrowAccount)` → `'active' | 'filled' | 'expired'`
6. `activeEscrows` = escrows where `status !== 'closed'`

---

## Escrow Data Shape (formatted)

```js
{
  id: string,           // escrow PDA public key
  publicKey: PublicKey,
  maker: string,
  depositToken: { mint, name, symbol, image, decimals },
  requestToken: { mint, name, symbol, image, decimals },
  depositAmount: number,     // human
  depositRemaining: number,
  depositAmountRaw: string,
  depositRemainingRaw: string,
  requestAmount: number,
  price: number,            // chain ratio
  seed: string,
  expireTimestamp: number,
  recipient: string | null,
  recipientPubkey: PublicKey,
  onlyRecipient: boolean,
  onlyWhitelist: boolean,
  allowPartialFill: boolean,
  whitelist: string | null,
  status: 'active' | 'filled' | 'expired'
}
```

---

## Storefront Store Dataflow

1. `loadStorefronts()` → fetch `STOREFRONT_REGISTRY_PATH` (`/storefronts/registry.json`)
2. Registry shape: `{ storefronts: [{ id, name, configUrl }] }`
3. Fetch each `configUrl` (relative to registry base or absolute)
4. Per storefront: `setSelectedStorefront(id)` triggers `storefrontMetadataStore.preloadStorefrontNFTs(storefront)` if not cached
5. `loadStorefrontTheme(storefront)` merges storefront `colors` (and optional fontSize, spacing, etc.) into theme
6. `refreshOpenTradesCounts(allEscrows)` updates per-storefront `openTradesCount` via `filterEscrowsByStorefront` + `filterActiveEscrows`

---

## Storefront Config Shape

From JSON (e.g. `race-protocol.json`):

```js
{
  id: string,
  name: string,
  logo?: string,
  collectionMints: [
    { mint, name?, symbol?, itemType?, fetchingType?, class?, category?, image?, uri?, sellerFeeBasisPoints? }
  ],
  baseCurrency: ['SOL', 'USDC', 'USDT'],
  customCurrencies?: [{ mint, name, symbol }],
  colors?: { primary, secondary, accent, background, text, border, status, trade, window },
  description?: string,
  verification_status?: 'verified' | 'community',
  subscriptionActive?: boolean,
  subscriptionExpiresAt?: string | null,
  tradeDiscount?: { enabled: boolean, appliesTo: string },
  shopFee?: { wallet, makerFlatFee?, takerFlatFee?, makerPercentFee?, takerPercentFee? }
}
```

---

## Storefront Metadata Store Dataflow

1. `preloadStorefrontNFTs(storefront)` for NFT collections in `collectionMints` where `fetchingType === 'NFT'`
2. Uses `fetchNFTsFromCollection(collectionMint)` (Helius DAS `getAssetsByGroup`) per collection
3. Enriches: `{ ...nft, collectionMint, collectionItem, fetchingType: 'NFT', isCollectionItem: true }`
4. Caches in `storefrontNFTsCache` and `tokenMetadataCache` (per mint)
5. `getCachedNFTs(storefrontId)` returns cached array; used for filters and selectors

---

## Marketplace Filtering

- `filterEscrowsByStorefront(escrows, storefront, { cachedCollectionMints })` – both deposit and request must belong to storefront
- `belongsToShop(mint, collection, { cachedCollectionMints })` – collection mints, cached NFT mints, or shop currencies
- `getTradeType(escrow, collectionMints, allowedCurrencies, cachedCollectionMints)` → `'buy' | 'sell' | 'trade' | 'swap' | null`
- `filterEscrowsByTradeType(escrows, tradeType, collection)`
- `filterActiveEscrows(escrows)` – `status === 'active'`
- `sortEscrowsByUserBalance(escrows, userBalances)` – user-fillable first via `canUserFillEscrow`
- `groupEscrowsByStorefront(escrows, storefronts, metadataStore)` – groups plus "P2P Trades" for unmatched

---

## Wallet Balances Composable

1. `fetchBalances(forceRefresh)`:
   - `fetchSOLBalance` + `fetchSPLTokenBalances` (DAS + RPC merge)
   - Cache TTL (60s) and duplicate-call guard
   - Timeout (25s) with retry (2 attempts)
2. `fetchAllTokenMetadata(tokens)` – batch metadata via `tokenStore.fetchTokenInfo`; cache-first
3. Watches `[connected, publicKey]` with `autoFetch: true` (default)
4. Returns: `balances`, `loading`, `loadingMetadata`, `error`, `fetchBalances`, `getTokenBalance`, `getTokenInfo`

---

## Token Store

- `fetchTokenInfo(mint)` – cache-first; fetches via RPC/metadata when missing
- Cache: localStorage `token_metadata_cache`; TTL 7 days; max 1000 entries
- Used by escrow formatting and wallet balance metadata enrichment

---

## Composables Summary

| Composable | Purpose |
|-----------|---------|
| useWalletContext | walletAdapter, anchorWallet, validateWallet (for tx) |
| useWalletStore | connected, publicKey, isWalletReady (read-only) |
| useSolanaConnection | Singleton Connection |
| useEscrowTransactions | initializeEscrow, exchangeEscrow, cancelEscrow; sendAndConfirm |
| useWalletBalances | balances, fetchBalances, metadata enrichment |
| useCollectionNFTs | fetchNFTsFromCollection (DAS) |
| useWalletNFTs | fetchWalletNFTsFromHelius |
| useStorefrontMetadata | preloadStorefrontNFTs, getCachedNFTs |

---

## Error Flow

- `escrowStore.errors`: `{ transaction, network, escrows, form }`
- Transaction errors: `useEscrowTransactions` → `escrowStore.setError('transaction', msg)`; `formatError` for user-facing text
- Escrow load errors: timeout/network-specific messages
- Balance errors: same timeout/network patterns
