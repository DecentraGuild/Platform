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
| [Environments](environments.md) | Env vars by app, run locally, deploy (API/Tenant/Platform), migrations, Discord reference |
| [Architecture](architecture-overview.md) | Flows, tenant resolution, API routes, DB tables, deploy targets, module routing |
| [Security notes](security-audit.md) | What was fixed (tenant takeover, path traversal), rate limits, debug off in prod |
