# C2C Reference: Other Important Structures

Extracted from `_integrate/C2C` for use when implementing in DecentraGuild. Architecture decisions, config, routes, and integration points.

---

## App Structure

- **Framework**: Vue 3 (Composition API) + Vite
- **Router**: Vue Router, history mode
- **State**: Pinia stores
- **Wallet**: solana-wallets-vue (Phantom, Solflare); Wallet Standard + Mobile Wallet Adapter for mobile
- **Styling**: Tailwind CSS + custom style.css with theme vars

---

## Routes

| Path | Name | Component |
|------|------|-----------|
| `/` | Dashboard | Dashboard |
| `/marketplace` | Marketplace | Marketplace |
| `/create` | Create | CreateEscrow |
| `/manage` | Manage | ManageEscrows |
| `/escrow/:id` | EscrowDetail | EscrowDetail |
| `/onboard` | OnboardCollection | OnboardCollection |
| `/terms` | TermsOfService | TermsOfService |
| `/privacy` | PrivacyPolicy | PrivacyPolicy |
| `/shopowner-agreement` | ShopownerAgreement | ShopownerAgreement |

Helpers:

- `getEscrowPath(escrowId)` → `/escrow/{id}`
- `getMarketplaceRoute(storefrontId)` → `{ path: '/marketplace', query?: { storefront } }`

---

## Deep Links

- `/escrow/ABC123` – direct escrow detail
- `?escrow=ABC123` – redirect to escrow detail
- `solana-mobile://...` – Solana Mobile deep links
- `redirectHelpers.js`: applies GitHub Pages-style redirects if needed

---

## Registry and Storefront Loading

1. Fetch `/storefronts/registry.json`:
   ```json
   { "storefronts": [{ "id", "name", "configUrl" }] }
   ```
2. Resolve configUrl: absolute URLs or relative to registry base
3. Fetch each config JSON (storefront shape in 02-dataflows.md)
4. Filter to `subscriptionActive` storefronts for display

---

## Constants Summary

**Escrow** (`escrow.js`):

- ESCROW_PROGRAM_ID, WHITELIST_PROGRAM_ID
- ESCROW_DEFAULTS: PARTIAL_FILL, SLIPPAGE_MILLI_PERCENT, MIN_EXPIRATION_MINUTES
- SLIPPAGE_DIVISOR: 100000
- VALIDATION_LIMITS

**Fees** (`fees.js`):

- FEE_CONFIG: MAKER_FEE_SOL/LAMPORTS, TAKER_FEE_SOL/LAMPORTS, WALLET
- CONTRACT_FEE_ACCOUNT
- TRANSACTION_COSTS: ESCROW_RENT, ATA_CREATION, TRANSACTION_FEE, etc.

**Tokens** (`tokens.js`):

- TOKEN_PROGRAM_ID_STR, TOKEN_2022_PROGRAM_ID_STR, MPL_CORE_PROGRAM_ID_STR
- NATIVE_SOL: { mint, decimals }
- COMMON_TOKENS (USDC, USDT mainnet/devnet)
- TOKEN_OBJECT_SCHEMA

**UI** (`ui.js`):

- UI_CONSTANTS: timeouts, cache TTLs, toast duration
- DEBOUNCE_DELAYS
- STORAGE_KEYS
- CACHE_CONFIG
- BATCH_SIZES
- SEARCH_LIMITS, SEARCH_SCORE
- STOREFRONT_REGISTRY_PATH

---

## IDL Location

`src/idl/escrow_service.json` – Anchor IDL for escrow program. Required for:

- Program instantiation
- Account shapes
- Instruction args (initialize, exchange, cancel)

---

## Key Utilities

| File | Purpose |
|------|---------|
| escrowTransactions.js | buildInitializeTransaction, buildExchangeTransaction, buildCancelTransaction, fetchAllEscrows, fetchEscrowByAddress |
| escrowHelpers.js | calculateEscrowStatus, formatEscrowData, calculatePrice |
| marketplaceHelpers.js | filterEscrowsByStorefront, getTradeType, canUserFillEscrow, groupEscrowsByStorefront |
| marketplaceFees.js | addMakerFeeInstructions, calculateTakerFee, getTotalMakerFee, getTotalTakerFee |
| transactionBuilders.js | getExchangeATAs, prepareTakerATAs, addAtaIfNeeded |
| heliusNFTs.js | fetchWalletNFTsFromHelius, fetchCollectionNFTsFromHelius, formatHeliusNFT, formatDASNFT |
| heliusDAS.js | getAssetsByOwner, dasAssetToBalance, fetchAllTokenBalancesFromDAS |
| ataUtils.js | checkAtaExists, makeAtaInstruction |
| wrappedSolHelpers.js | isWrappedSol, getWrappedSolAccount, addWrappedSolInstructions |
| tokenProgramUtils.js | getTokenProgramIdForMint (validates legacy SPL) |
| metaplex.js | fetchTokenMetadata |
| memo.js | createMemoInstruction |
| formatters.js | fromSmallestUnits, cleanTokenString |
| errorHandler.js | formatError (user-facing messages) |
| rateLimiter.js | metadataRateLimiter for metadata fetches |

---

## Bootstrap Flow (main.js)

1. Create app, Pinia, router
2. Validate VITE_HELIUS_API_KEY in prod
3. `initializeWalletDetection()` (mobile Wallet Standard)
4. `app.use(SolanaWallets, walletOptions)` – Phantom, Solflare, autoConnect
5. `themeStore.initializeTheme()` before mount
6. mount

---

## App.vue Initialization

- NavBar, RouterView, ToastContainer
- Watch route + selectedStorefront → load storefront theme or reset
- `useNetworkStatus()` for connectivity
- `tokenStore.preloadRegistry()` on mount (background)

---

## Component Patterns

- **Base components**: BaseModal, BaseDropdown, BaseSearchInput, BaseEmptyState, BaseNavLink, BaseScrollArea, BaseAddressDisplay, BaseTokenImage, BaseViewModeToggle, BaseShareModal
- **Token components**: TokenSelector, TokenAmountSelector, TokenAmountDisplay, TokenDisplay, PriceDisplay, RequestTokenSelector
- **Escrow components**: EscrowCard, MarketplaceEscrowCard, EscrowDetailsSection, EscrowFillSection, EscrowPriceDisplay, EscrowStatusMessage, MarketplaceEscrowSection
- **Collection components**: CollectionCard, CollectionListItem, CollectionDetailsModal, CollectionSelector, CollectionBadge
- **Filters**: MarketplaceFilters, useMarketplaceFilters
- **Modals**: ConfirmModal, PricingModal
- **Nav**: NavBar, NavBarStorefrontSelector, NavBarMenuButton

---

## Integration Points for DecentraGuild

1. **packages/web3**: Escrow tx builders, DAS/Helius helpers, wallet balance logic
2. **packages/contracts**: IDL, program constants
3. **packages/ui**: Theme vars, button/card styles, base components
4. **packages/core**: Storefront/tenant config loading (registry pattern)
5. **apps/tenant**: Marketplace views, create/manage escrow flows, storefront theme
6. **apps/api**: Optional: registry endpoint, storefront metadata cache (if moving off static JSON)
7. **configs/marketplace**: Storefront JSON files (per-tenant config)

---

## Migration Notes

- C2C uses standalone Vite app; DecentraGuild uses Nuxt tenant app. Map views to pages; stores/composables can move to packages or tenant-specific.
- Theme: merge C2C theme structure with packages/ui theme store; ensure CSS var naming is consistent.
- Storefront = tenant in DecentraGuild; registry can become API-driven or config-based.
- Escrow program ID and fee accounts are shared; keep constants in packages/contracts or central config.
