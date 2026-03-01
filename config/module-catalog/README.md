# Module catalog

Billable modules define `pricing` in their JSON. The Admin pricing widget reads this and shows live pricing.

## Docs

Module and platform documentation lives in `docs/`. The platform app reads from `apps/platform/content/docs`, which is a junction (symlink) to this `docs/` folder. On a fresh clone, create the junction:

```powershell
# From repo root
New-Item -ItemType Junction -Path apps\platform\content\docs -Target (Resolve-Path config\module-catalog\docs).Path -Force
```

Structure:

- `docs/index.md` — Docs landing
- `docs/general/*.md` — Platform-wide docs (getting started, billing, etc.)
- `docs/modules/*.md` — Per-module docs (admin, marketplace, discord)

## Yearly discount

To offer a yearly discount, set `yearlyDiscountPercent` (e.g. `25` for 25% off):

```json
{
  "pricing": {
    "modelType": "tiered_addons",
    "yearlyDiscountPercent": 25,
    ...
  }
}
```

Discord and Marketplace use 25%. Set to `0` or omit to disable.

## Live conditions

For pricing to update as the admin configures the module, the admin tab must pass `conditions` to `AdminPricingWidget`. See `AdminMarketplaceTab` and `AdminDiscordTab` for the pattern.
