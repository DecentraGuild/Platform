# Marketplace module (storefront)

C2C marketplace for the tenant. Active when the dGuild has this module enabled.
Route: `/market`.

## Browse grid

- **Card size:** A "Card size" slider above the grid (top right) controls the minimum card width (7–18rem). Preference is stored in `localStorage` under `market-grid-scale`. Default 10rem for readable NFT names and thumbnails.
- **AssetCard:** Name uses `--theme-font-sm`, symbol/mint use `--theme-font-xs` for readability.
