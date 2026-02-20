# Environments

## Tenant config loading

Tenant config can be read from the filesystem (JSON per slug) or from the database. Two loaders exist:

- **API registry** (`apps/api/src/config/registry.ts`): Used by the API for health check, debug endpoint, tenant list, and startup seed. It reads only from `TENANT_CONFIG_PATH`. If that env var is not set, the registry returns no config (health reports `tenantConfigPath: null`). **Production should set `TENANT_CONFIG_PATH`** so the API can load tenant JSON when the DB is empty or for seeding.
- **Core loader** (`packages/core/src/loader.ts`): Used by the API in tenant-settings when resolving a tenant (DB first, then file fallback). It has fallbacks: `TENANT_CONFIG_PATH` if set, else `configs/tenants` in cwd, else monorepo-relative paths from `apps/api` or `apps/api/dist`. Those fallbacks are for **local/dev**; in production the API sets `TENANT_CONFIG_PATH` (or relies on the registry after ensureTenantConfigPath).

Use the **registry** for API-internal health, debug, list, and seed. Use **core `loadTenantConfig`** where you want file fallback (e.g. tenant-settings after DB miss).

## Local development

- **Tenant app**: `pnpm --filter tenant dev` — port 3002. Use `?tenant=skull` for local tenant.
- **Platform app**: `pnpm --filter platform dev` — port 3000.
- **API**: `pnpm --filter api dev` — port 3001.

### Env vars

| Var | Used by | Purpose |
|-----|---------|---------|
| `NUXT_PUBLIC_API_URL` | tenant, platform | API URL. In development defaults to `http://localhost:3001`; in production to `https://api.dguild.org`. Override if needed. Same name in both apps. |
| `NUXT_PUBLIC_HELIUS_RPC` | tenant, platform | Helius RPC for client (wallet, DAS). Same name in both apps. |
| `DATABASE_URL` | API | Postgres. Railway provides via Add Reference. |
| `SESSION_SECRET` | API | Min 32 chars. Generate: `openssl rand -base64 32`. |
| `CORS_ORIGIN` | API | Explicit origins: platform (e.g. `https://dguild.org`) and localhost for dev. Tenant subdomains (`https://*.dguild.org`) are allowed dynamically; no need to add each tenant. |

### Local tenant resolution

- **Host**: `localhost` or `127.0.0.1`
- **Query**: `?tenant=skull` → slug = `skull`

## Environment variables summary

| App | Variable | Required | Description |
|-----|----------|----------|-------------|
| API | `DATABASE_URL` | Yes (for DB and PATCH) | Postgres connection string. Railway: Add Reference from Postgres. |
| API | `SESSION_SECRET` | Yes (production auth) | Min 32 chars. Generate: `openssl rand -base64 32`. |
| API | `CORS_ORIGIN` | Yes (production) | Explicit origins, comma-separated: platform + localhost. Tenant subdomains allowed dynamically. |
| API | `CORS_TENANT_DOMAIN` | No | Tenant base domain for CORS (e.g. `.dguild.org`). Default: `.dguild.org`. Set only if different from resolver. |
| API | `TENANT_CONFIG_PATH` | No | Path to directory with `{slug}.json` tenant configs. Production should set for health and seed. |
| API | `PORT` | No | Server port. Default 3001; Railway sets automatically. |
| API | `NODE_ENV` | No | e.g. `production`. |
| Tenant | `NUXT_PUBLIC_API_URL` | No | API base URL. Dev: `http://localhost:3001`; production: `https://api.dguild.org`. No trailing slash. |
| Tenant | `NUXT_PUBLIC_HELIUS_RPC` | Yes (marketplace) | Helius RPC URL. Required for marketplace (wallet balances, escrows, tx). Public Solana RPC returns 403. |
| Platform | `NUXT_PUBLIC_API_URL` | No | Same as tenant. |
| Platform | `NUXT_PUBLIC_HELIUS_RPC` | No | Same as tenant. |

## GitHub secrets (deploy)

| Secret | Purpose |
|--------|---------|
| `NUXT_PUBLIC_API_URL` | API URL in static build (tenant and platform). |
| `NUXT_PUBLIC_HELIUS_RPC` | Helius RPC for client. |

## Deploy: static JSON vs database

- **Repo JSON** (`configs/tenants/*.json`) is not “pushed into the API” by the frontend deploy. The tenant and platform apps are static builds (Netlify); the API is a separate service (Railway). When you push and **redeploy the API**, the new code and any config path it uses (e.g. `configs/tenants` in the same repo) go up with that deploy.
- **With DB (Railway Postgres):** Set `DATABASE_URL` on the API. On startup the API runs migrations (creates `tenant_config` table), then seeds from static JSON (e.g. `skull.json`) into the DB. After that, tenant context and Admin save use the **database**. The table name is `tenant_config` (not the database name). Edits in Admin persist in the DB; they do not write back to the repo JSON.
- **Without DB (e.g. local):** The API reads tenant from `TENANT_CONFIG_PATH` (or repo `configs/tenants`). Admin save writes back to the JSON file under that path so changes persist locally.

## Deployment

- **Platform**: Static build → Netlify (dguild.org). Config: `apps/platform/netlify.toml`.
- **Tenant**: Static build → Netlify (*.dguild.org). Config: `apps/tenant/netlify.toml`.
- **API**: Railway.
- **Subdomains**: `{slug}.dguild.org` → tenant slug.

### Netlify setup

1. Create two Netlify sites from the same repo.
2. **Platform site**: Build settings → **Package directory** = `apps/platform`. Leave Base directory empty.
3. **Tenant site**: Build settings → **Package directory** = `apps/tenant`. Leave Base directory empty.
4. Add env vars (Build settings > Environment): `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_HELIUS_RPC`.
5. Node version: `.nvmrc` (20) and `NODE_VERSION` in each app’s netlify.toml. See `docs/netlify-deploy.md` for full steps.
