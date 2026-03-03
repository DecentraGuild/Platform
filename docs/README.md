# Documentation

Essential reference so we don't make mistakes. For repo layout and running locally, see the [root README](../README.md).

## Avoid mistakes

- **Do not edit `_integrate/`** – Reference only. Implement in `apps/` or `packages/`.
- **No hardcoded tenant slug or domain** – Use env: `NUXT_PUBLIC_DEV_TENANT`, `NUXT_PUBLIC_TENANT_BASE_DOMAIN`, `VERIFY_URL_TEMPLATE`, etc. API seeds all tenants from registry (no single slug in code). See [Environments](environments.md).
- **Theming** – Single source in `packages/ui` (defaults + vars.css). Tenant theme comes from tenant config only.
- **Lists / dropdowns** – Discord condition types from API; module nav from `apps/tenant/src/config/modules.ts`. Don't duplicate.
- **Adding a tenant** – Add `configs/tenants/<slug>.json` and optionally `configs/marketplace/<slug>.json`. No code change. API seeds them on startup when DB is used.
- **Slug validation** – Any slug from client (URL, body) must pass `isValidTenantSlug` before use in paths or DB. See `apps/api/src/validate-slug.ts`.

## Build warnings (safe to ignore)

- **Nitro / cache-driver:** During `nuxt build` or `nuxt generate`, you may see: `"cache-driver.js" is imported by "virtual:#nitro-internal-virtual/storage", but could not be resolved – treating it as an external dependency`. This is a known Nuxt/Nitro quirk (especially on Windows). The build completes and the app runs; you can ignore it.

## Docs

| Doc | Purpose |
|-----|---------|
| [Adding a new module](adding-a-new-module.md) | End-to-end guide: scope, catalog, nav, pricing, API, Admin, activation |
| [Environments](environments.md) | Env vars by app, run locally, deploy (API/Tenant/Platform), migrations, Discord reference |
| [DB restore](db-restore.md) | Restore Postgres from R2 backup (disaster recovery, migration) |
| [Core logic flow](core-logic-flow.md) | Tenant to catalog to conditions to billing to DB to web3; entry points and design rules. |
| [Config layout](config-layout.md) | Tenant config source of truth (DB vs file), module catalog, and config paths. |
| [Architecture (agent)](../.cursor/memory/) | Flows, tenant resolution, API routes, DB tables. See `.cursor/index.md` and `memory/` quick refs. |
| [Security notes](security-audit.md) | What was fixed (tenant takeover, path traversal), rate limits, debug off in prod |
| [Netlify setup](netlify-setup.md) | Tenant and platform sites: base dir, build, publish, env, custom domains |
| [Tenant publish checklist](tenant-publish-checklist.md) | Fix "Site not found" / "Tenant not found": Netlify domains, API seed, verification, diagnostics |
