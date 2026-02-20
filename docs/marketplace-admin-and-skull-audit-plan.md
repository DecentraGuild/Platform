# Marketplace admin collection drill-down + Skull config full audit

Plan to (1) add a collection drill-down in marketplace admin with thumbnails and stored values, and (2) run a one-time full checkup on skull configs, fetch missing metadata, and fill JSONs so all tenants can rely on complete data via the admin module.

---

## Part A: Marketplace admin – click collection, view NFTs

### Goal

In Admin > Marketplace, when an admin clicks an NFT collection row (or a "View" action), open a view that:

- Shows **stored config** for that collection (what we keep in JSON/DB): name, image URL, sellerFeeBasisPoints, groupPath, mint address.
- Shows **member NFTs** in a grid like the existing request selector: thumbnail, name, mint address, and the metadata we store (name, image, decimals, traits, sellerFeeBasisPoints from `mint_metadata` / assets API).

No shortcuts: reuse the same assets API and UX patterns as the request selector so behaviour is consistent.

### Current state

- [apps/tenant/src/components/AdminMarketplaceSettings.vue](apps/tenant/src/components/AdminMarketplaceSettings.vue): NFT collections are a flat list. Each row shows name (or truncated mint), meta line (collectionSize, uniqueTraitCount, trait types). No click-to-expand, no thumbnails, no per-NFT view.
- [apps/tenant/src/modules/marketplace/components/NftInstanceSelectorModal.vue](apps/tenant/src/modules/marketplace/components/NftInstanceSelectorModal.vue): Uses `useMarketplaceAssets({ slug, collection: collectionMint, limit: 500 })` to load NFTs for a collection; displays grid with image, name, traits; search and trait filters.
- Assets API: `GET /api/v1/tenant/:slug/marketplace/assets?collection=<mint>&limit=&page=` returns `assets` (with metadata from `mint_metadata`: name, symbol, image, decimals, traits) and `scope`. Metadata is populated when scope is expanded (DAS + upsert to `mint_metadata`).

### Tasks (Part A)

1. **Collection row action**
   - In `AdminMarketplaceSettings.vue`, add a "View NFTs" (or similar) control per collection row (e.g. button or clickable row). Set a reactive `selectedCollection` (the collection mint + stored name/image/sellerFeeBasisPoints/groupPath from the form item).

2. **Collection detail modal / panel**
   - New component (e.g. `AdminCollectionDetailModal.vue`) used only in admin:
     - **Props**: `modelValue` (open/close), `slug`, `collection` (mint + stored config: name, image, sellerFeeBasisPoints, groupPath).
     - **Stored config block**: Show collection name, mint (with copy + Solscan link), image (thumbnail), sellerFeeBasisPoints, groupPath. Label clearly as "Stored in config".
     - **Member NFTs block**: Reuse the same data source as the request selector:
       - Call `useMarketplaceAssets({ slug, collection: ref(collection.mint), limit: 500 })` (or equivalent: same API with `collection=` and high limit).
       - Grid of cards: thumbnail (metadata.image), name (metadata.name), mint (truncated + copy), and optionally a small "Stored" section per card: name, image, decimals, traits count, sellerFeeBasisPoints (from assets API metadata). Use the same card layout as `NftInstanceSelectorModal` (thumbnail + name + traits) plus address and stored fields.
     - Handle loading and empty state; no need for search/filters in v1 unless we want parity with the selector.

3. **Thumbnails**
   - Images come from the assets API (`metadata.image`). Ensure scope has been expanded so `mint_metadata` (and thus assets response) has images for member mints. If not, scope expansion already upserts image from DAS; admin can run "Expand scope" or we document that expanding scope fills metadata.

4. **Where it lives**
   - New component under `apps/tenant/src/components/` (e.g. `AdminCollectionDetailModal.vue`), used only from `AdminMarketplaceSettings.vue`. No changes to `NftInstanceSelectorModal` except possibly extracting a shared presentational grid component later if useful.

### Acceptance

- Admin can open a collection from the marketplace settings list and see:
  - Stored config (name, image, sellerFeeBasisPoints, groupPath, mint).
  - A grid of member NFTs with thumbnail, name, mint address, and the metadata we store (so they know what is cached and what would be shown in the app).

---

## Part B: Skull config full checkup and fill JSONs

### Goal

- Audit `configs/tenants/skull.json` and `configs/marketplace/skull.json` for missing or incomplete fields.
- For every mint (collections, currencies, SPL assets), fetch from chain/DAS the fields we support (name, symbol, image, decimals, sellerFeeBasisPoints) and fill the JSONs so that:
  - Skull is a complete reference.
  - Other guilds going through the admin module get the same quality of data when we use these as defaults or reference.

Manual one-time process: run fetches, verify, then update the JSON files. No shortcuts: every mint checked, every supported field filled where available.

### Token metadata: seller vs buyer fee

Metaplex Token Metadata only has **seller_fee_basis_points** (creator royalty on secondary sales). There is **no buyerFeeBasisPoints** in the standard. Marketplace or platform fees (maker/taker) are separate and we store them as `shopFee` in the config.

### Resolve by mint (API mint list)

The API keeps a canonical mint list in the `mint_metadata` table. When serving marketplace config (tenant-context or GET marketplace-settings), we enrich `currencyMints` and `splAssetMints` from `mint_metadata`: config entry overrides when present, otherwise DB metadata is used. So tenant JSON can store only `mint` (or mint + overrides); the API fills name, symbol, decimals, image, sellerFeeBasisPoints when returning. On PATCH marketplace-settings, the API upserts each submitted currency/SPL mint into `mint_metadata` so the canonical list stays updated.

### Data we store (reference)

- **collectionMints** (per item): `mint`, `name`, `image`, `sellerFeeBasisPoints`, `groupPath`.
- **currencyMints**: `mint`, `name`, `symbol`, `decimals`, `image`, `sellerFeeBasisPoints` (all optional except mint; API fills from mint_metadata when missing).
- **splAssetMints**: `mint`, `name`, `symbol`, `decimals`, `image`, `sellerFeeBasisPoints` (same).

APIs used for fetch:

- Collection: `GET /api/v1/marketplace/asset-preview/collection/:mint` → name, image, collectionSize, uniqueTraitCount, traitTypes (and backend has DAS so can expose sellerFeeBasisPoints if we add it to the response).
- SPL/currency: `GET /api/v1/marketplace/asset-preview/spl/:mint` → name, symbol, image, decimals, sellerFeeBasisPoints.

### Current skull state (from repo)

**configs/marketplace/skull.json**

- **collectionMints** (2):
  - `CL2m6JiuV8H7X6cqzMqHNGWbJncj7HZ2BFXd8sQYStQ3`: name "Year 2 NFT", image URL, sellerFeeBasisPoints 1000, groupPath ["Year 2"].
  - `6LomcBw8DVUE3T1XBLK1PZDiRyHYtFYo9E6v9UXeqjHE`: name "Year 3 NFT", image URL, sellerFeeBasisPoints 1000, groupPath ["Year 3"].
  - Check: Verify image URLs load; confirm name/sellerFeeBasisPoints match chain if desired.

- **currencyMints** (5):
  - All have mint, name, symbol, decimals.
  - Optional: add `image` for each if DAS returns one (e.g. SOL/WBTC/USDC/ATLAS/POLIS).

- **splAssetMints** (2):
  - DAOB, DACB: mint, name, symbol, decimals. No `image` or `sellerFeeBasisPoints`.
  - Fetch and add image and sellerFeeBasisPoints if available.

**configs/tenants/skull.json**

- Tenant branding and theme only; no marketplace data (marketplace is in `configs/marketplace/skull.json`). No changes needed here for marketplace data.

### Tasks (Part B)

1. **Audit checklist**
   - [ ] List every mint in `configs/marketplace/skull.json`: 2 collection mints, 5 currency mints, 2 SPL asset mints.
   - [ ] For each, list which of (name, symbol, image, decimals, sellerFeeBasisPoints, groupPath) are present and which are missing or wrong.

2. **Fetch missing data**
   - Use existing API or a small script (see below):
     - For each **collection** mint: call asset-preview/collection, get name, image, sellerFeeBasisPoints (if we add to API response; else from DAS getAsset). Update JSON: name, image, sellerFeeBasisPoints.
     - For each **currency** mint: call asset-preview/spl, get name, symbol, decimals, image. Update JSON; add image if present.
     - For each **SPL asset** mint: call asset-preview/spl, get name, symbol, decimals, image, sellerFeeBasisPoints. Update JSON; add image and sellerFeeBasisPoints.
   - If API does not return sellerFeeBasisPoints for collection preview, add it in [apps/api/src/marketplace/asset-preview.ts](apps/api/src/marketplace/asset-preview.ts) from DAS metadata (e.g. `meta?.seller_fee_basis_points`).

3. **One-time script (optional but recommended)**
   - Script (e.g. `scripts/fill-marketplace-metadata.ts` or Node script in `scripts/`):
     - Reads `configs/marketplace/skull.json`.
     - For each collectionMints item: GET asset-preview/collection/:mint (or call fetchCollectionPreview internally), write back name, image, sellerFeeBasisPoints.
     - For each currencyMints and splAssetMints item: GET asset-preview/spl/:mint (or fetchSplAssetPreview), write back name, symbol, decimals, image, sellerFeeBasisPoints where applicable.
     - Writes updated JSON to `configs/marketplace/skull.json` (or to a copy for review, then manually replace). Run once; no ongoing automation.

4. **Verify and fix admin save payload**
   - When adding a collection in the admin UI, the client currently does not set `image` from the collection preview response. In `AdminMarketplaceSettings.vue`, in `addCollection()`, set `image: data.image ?? undefined` (and sellerFeeBasisPoints if returned) so that newly added collections persist image and fees.

5. **Document**
   - After run: document in this file or in a short "Skull audit" note what was missing and what was filled (e.g. "SPL DAOB/DACB: added image and sellerFeeBasisPoints from DAS").

### Order of work (Part B)

1. Add sellerFeeBasisPoints to collection preview API response if missing.
2. Implement optional script that reads skull.json, fetches all mints via existing preview APIs, and produces an updated JSON (or patch).
3. Run script (or manual API calls) for skull; verify image URLs and decimals.
4. Update `configs/marketplace/skull.json` with the filled values.
5. Fix admin UI to persist collection image (and sellerFeeBasisPoints) when adding a collection.
6. Re-run scope expand for skull so DB/scope and metadata are in sync with the updated config.

### Acceptance

- Every mint in skull marketplace config has name; collections have image and sellerFeeBasisPoints; currencies and SPL assets have symbol and decimals; SPL assets have image and sellerFeeBasisPoints where DAS provides them.
- No placeholder or "TODO" left in the JSON; missing optional fields (e.g. image for a token that has none) are omitted, not empty strings.
- Admin "Add collection" persists image and sellerFeeBasisPoints from the preview response.

---

## Summary

| Part | What | Outcome |
|------|------|--------|
| A | Marketplace admin collection drill-down | Click collection → modal with stored config + grid of member NFTs (thumbnails, address, stored metadata). Reuse assets API and selector-style grid. |
| B | Skull config audit + fill | Audit all mints in skull.json; fetch name/symbol/image/decimals/sellerFeeBasisPoints; update JSON once; fix admin to persist collection image/sellerFeeBasisPoints on add. |

Work through Part A and Part B in order; no skipping steps. Part B script can be run after Part A is implemented so the admin can also be used to verify the filled data.
