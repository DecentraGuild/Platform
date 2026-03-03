# Tenant publish checklist

Use this when deploying the tenant shell so directory "Visit" links load correctly (no "Site not found" or "Tenant not found").

## API and DB (fixes "Tenant not found")

In production the API resolves tenants **only from the database**. It does not read `configs/tenants/*.json` unless `TENANT_CONFIG_PATH` is set (typical for local only). So production must have `tenant_config` populated.

### 1. Seed the production DB once

From the repo root, with access to production Postgres and tenant configs:

- Set `DATABASE_URL` to your production Postgres URL.
- Ensure tenant config path is available. If the repo has `configs/tenants/`, you can rely on the default (no extra env). Otherwise set `SEED_TENANTS_PATH` (or `TENANT_CONFIG_PATH`) to the directory containing `{slug}.json` files.

Then run:

```bash
pnpm --filter api run seed:tenants
```

This runs migrations and upserts all tenants (and marketplace configs) from the config files into the DB. After this, `tenant_config` has rows with `slug` and `id` matching what the directory uses (e.g. `skull`, `dguild`).

### 2. Verify API responses

- **List tenants:** `GET https://api.dguild.org/api/v1/tenants` must return `{ tenants: [ ... ] }` with the expected orgs. Each tenant should have `slug` (or `id`) that matches the subdomain you use (e.g. `skull` for `skull.dguild.org`).
- **Tenant context:** `GET https://api.dguild.org/api/v1/tenant-context?slug=skull` must return **200** and `{ tenant, marketplaceSettings?, raffleSettings? }`. If this returns 404 while `/tenants` lists a tenant with slug `skull`, the row may have no `slug` or a different value; re-run seed or fix the config file and seed again.

### 3. Same API URL everywhere

Platform and tenant app must call the **same** API. Set `NUXT_PUBLIC_API_URL` (no trailing slash) in Netlify build env for **both** the platform site and the tenant site, e.g. `https://api.dguild.org`.

### 4. CORS

The API allows tenant subdomains dynamically. Ensure `CORS_ORIGIN` (and optional `CORS_TENANT_DOMAIN`, e.g. `.dguild.org`) are set on the API so requests from `https://skull.dguild.org` (and other tenant subdomains) are allowed.

## Netlify (fixes "Site not found")

Subdomains like `skull.dguild.org` must be served by the **same** Netlify site that builds and deploys the tenant app. If the subdomain is on another site or not added, Netlify returns its own "Site not found" 404.

- **One tenant site:** One Netlify site with Base directory `apps/tenant`, build `pnpm run build:tenant`, publish `.output/public`.
- **Custom domains:** In that site’s Domain management, add either the wildcard `*.dguild.org` or each subdomain (e.g. `skull.dguild.org`, `dguild.dguild.org`) and point DNS to Netlify (CNAME or Netlify DNS).

See [netlify-setup.md](netlify-setup.md) for full Netlify and build/env details.

## Optional diagnostics

- **API health:** `GET https://api.dguild.org/api/v1/health` returns `{ status, tenantConfigPath?, tenantConfigOk?, seedPending? }`. Use it to confirm you are hitting the right API and (in non-production) whether file-based tenant config is present or seed is still running. In production, DB is source of truth so `tenantConfigPath` is often unset.
- **Tenant-context debug (staging only):** If `GET /api/v1/tenant-context?slug=skull` returns 404, you can add `&debug=1` when **not** in production. The 404 response body will include a `diagnostic` field with tenant config path and load details. Do not enable in production.
- **Which error when:** Note the exact URL that shows "Site not found" (Netlify 404) vs "Tenant not found" (API 404). The first means that host is not served by the tenant Netlify site; the second means the API could not resolve that slug in the DB.
