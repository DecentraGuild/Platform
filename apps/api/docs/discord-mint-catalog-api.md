# Discord mint catalog API

Per-Discord-server catalog of SPL tokens and NFT collections. Admins add mints here (below "Linking server"); rule creation then uses dropdowns of these entries instead of free-form mint input.

## Data model

- **Table:** `discord_guild_mints`
  - `id` (SERIAL), `discord_guild_id`, `asset_id` (mint or collection address), `kind` ('SPL' | 'NFT'), `label` (human-readable name), `created_at`, `updated_at`
  - `UNIQUE(discord_guild_id, asset_id)` so the same mint cannot be added twice per guild.

Metadata (name, symbol, image, decimals, traits) lives in `mint_metadata`; catalog creation ensures metadata is loaded before inserting a row.

## Endpoints

All require tenant admin and a linked Discord server for the tenant.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tenant/:slug/discord/mints` | List catalog entries for the guild. Response includes `id`, `asset_id`, `kind`, `label`, and optional preview fields (e.g. `symbol`, `image`) from `mint_metadata`. |
| POST | `/api/v1/tenant/:slug/discord/mints` | Create a catalog entry. Body: `asset_id` (required), optional `kind` when auto-detect fails. Server fetches metadata (mint-preview or collection-preview), infers SPL vs NFT when possible; if ambiguous or fail, client may send `kind` and server retries. On success inserts row with `label` from metadata. |
| DELETE | `/api/v1/tenant/:slug/discord/mints/:id` | Delete a catalog entry. Fails with 400 if any rule condition still references this asset (payload.mint or payload.collection_or_mint). |

## Rules integration

- Rules continue to store **raw** `mint` or `collection_or_mint` in condition payloads. Holder sync and `getConfiguredAssetsByGuildId` are unchanged.
- The catalog is only used by the tenant admin UI to populate dropdowns and enforce "metadata loaded before use."

## Migrating existing rules into the catalog

For existing Discord servers that already have SPL/NFT/TRAIT rules configured, you can pre-populate the mint
catalog from current conditions. Run a one-off SQL statement (for each guild or globally) similar to:

```sql
INSERT INTO discord_guild_mints (discord_guild_id, asset_id, kind, label)
SELECT DISTINCT
  r.discord_guild_id,
  CASE c.type
    WHEN 'SPL' THEN c.payload->>'mint'
    ELSE c.payload->>'collection_or_mint'
  END AS asset_id,
  CASE WHEN c.type = 'SPL' THEN 'SPL' ELSE 'NFT' END AS kind,
  COALESCE(mm.name, mm.symbol, LEFT(
    CASE c.type
      WHEN 'SPL' THEN c.payload->>'mint'
      ELSE c.payload->>'collection_or_mint'
    END,
    8
  ) || '…') AS label
FROM discord_role_conditions c
JOIN discord_role_rules r ON r.id = c.role_rule_id
LEFT JOIN mint_metadata mm ON mm.mint = CASE c.type
  WHEN 'SPL' THEN c.payload->>'mint'
  ELSE c.payload->>'collection_or_mint'
END
WHERE c.type IN ('SPL', 'NFT', 'TRAIT')
  AND (c.payload->>'mint' IS NOT NULL OR c.payload->>'collection_or_mint' IS NOT NULL)
ON CONFLICT (discord_guild_id, asset_id) DO NOTHING;
```

This keeps the rule engine behaviour unchanged while ensuring the new catalog UI shows all assets already in use.
