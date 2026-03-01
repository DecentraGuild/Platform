# Environments

Single reference for env vars, run locally, and deploy.

## Run locally

| App | Command | URL |
|-----|---------|-----|
| API | `pnpm --filter api dev` | http://localhost:3001 |
| Platform | `pnpm --filter platform dev` | http://localhost:3000 |
| Tenant | `pnpm --filter tenant dev` | http://localhost:3002 – use `?tenant=<slug>` (default slug: `skull`; override with `NUXT_PUBLIC_DEV_TENANT`) |
| Discord bot | `pnpm --filter discord-bot dev` | (after API is up) |

Tenant config: API reads from `TENANT_CONFIG_PATH` or infers `configs/tenants` in repo. With DB, API seeds all `configs/tenants/*.json` and `configs/marketplace/*.json` on startup. Without DB, Admin save writes back to JSON.

## Environment variables (by app)

| App | Variable | Required | Description |
|-----|----------|----------|-------------|
| API | `DATABASE_URL` | Yes (DB + admin save) | Postgres. Railway: Add Reference. |
| API | `SESSION_SECRET` | Yes (production) | Min 32 chars. `openssl rand -base64 32`. |
| API | `CORS_ORIGIN` | Yes (production) | Platform + localhost. Tenant subdomains allowed dynamically. |
| API | `CORS_TENANT_DOMAIN` | No | Tenant base domain for CORS. Default `.dguild.org`. |
| API | `TENANT_CONFIG_PATH` | No | Dir with `{slug}.json`. Production should set. |
| API | `PORT`, `NODE_ENV` | No | Default 3001. |
| Tenant | `NUXT_PUBLIC_API_URL` | No | API URL. Dev: `http://localhost:3001`; prod: `https://api.dguild.org`. No trailing slash. |
| Tenant | `NUXT_PUBLIC_DEV_TENANT` | No | Default tenant on localhost. Default `skull`. |
| Tenant | `NUXT_PUBLIC_HELIUS_RPC` | Yes (marketplace) | Helius RPC. |
| Platform | `NUXT_PUBLIC_API_URL` | No | Same as tenant. |
| Platform | `NUXT_PUBLIC_TENANT_BASE_DOMAIN` | No | Base domain for directory Visit links. Default `dguild.org`. |
| Platform | `NUXT_PUBLIC_HELIUS_RPC` | No | Same as tenant. |
| Discord bot | `DISCORD_BOT_TOKEN` | Yes | Bot token. |
| Discord bot | `DISCORD_BOT_API_SECRET` | Yes | Same as API (server-to-server). |
| Discord bot | `API_BASE_URL` | No | Default `http://localhost:3001`. |
| Discord bot | `DISCORD_APPLICATION_ID` | No | Optional; bot can fetch at runtime. |
| Discord bot | `VERIFY_URL_TEMPLATE` | No | Placeholders `{{slug}}`, `{{token}}`. Default `https://{{slug}}.dguild.org/verify?token={{token}}`. Local dev: `http://localhost:3002/verify?token={{token}}` (verify page is on tenant app). |
| **Worker** | `DATABASE_URL` | Yes | Same as API. |
| **Worker** | `BACKUP_BUCKET`, `BACKUP_ACCESS_KEY_ID`, `BACKUP_SECRET_ACCESS_KEY`, `BACKUP_ENDPOINT` | No | R2 backup. Add to worker service on Railway for daily DB backups. |

**Restore:** See [docs/db-restore.md](db-restore.md) for restoring from an R2 backup.

Deploy (GitHub/Netlify): set `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_HELIUS_RPC` in build env.

## Deploy

- **API (Railway):** Root directory `apps/api` (or repo root with start `pnpm --filter api start`). Build: `pnpm install && pnpm --filter api build`. Start: `node dist/index.js`. Migrations run automatically on startup when `DATABASE_URL` is set. Custom domain: add in Railway API service → Domains; set `NUXT_PUBLIC_API_URL` in frontends with **no trailing slash**.
- **Platform / Tenant (Netlify):** Two sites from same repo. Package directory `apps/platform` and `apps/tenant`. Node from `.nvmrc`. Env: `NUXT_PUBLIC_API_URL` (no trailing slash), `NUXT_PUBLIC_HELIUS_RPC`. **Subdomains:** `{slug}.dguild.org` → one tenant Netlify site; add `*.dguild.org` or each subdomain as custom domain on **that same site**. "Site not found" on a subdomain = subdomain is on a different Netlify site; add it to the tenant site that already serves the app.
- **CORS (API):** Set `CORS_ORIGIN` to platform + localhost only; tenant subdomains are allowed dynamically. If using a different tenant domain, set `CORS_TENANT_DOMAIN` (e.g. `.dguild.org`).

## Migrations

- **Location:** `apps/api/src/db/migrations/*.sql`. Files run in lexicographic order (001_, 002_, …).
- **When:** Run automatically on API startup when `DATABASE_URL` is set.
- **Adding one:** New file e.g. `014_description.sql`. Use `IF NOT EXISTS` / `IF EXISTS` for idempotency. Restart API to run.

## Discord module (reference)

- **API:** Tenant/rule storage, holder sync (RPC/DAS), rule engine, bot auth, verify sessions, wallet links.
- **Bot (apps/discord-bot):** Serves all linked servers: `/verify`, role add/remove; calls API with `x-bot-secret` and `x-discord-guild-id`.
- **Tenant app:** Admin (connect server, rules); user verify page (link wallet).
- **Run order (local):** API → tenant app → bot. From root: `pnpm dev` starts all three.
- **Dev Portal:** Server Members Intent required. OAuth: scopes `bot`, permissions Manage Roles + Use Application Commands.
- **Diagnostic:** `pnpm --filter api exec tsx scripts/test-holder-fetch.ts <MINT> [SPL|NFT]` (needs `HELIUS_RPC` or `HELIUS_RPC_URL` in API env).
