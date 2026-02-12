# Environments

## Local development

- **Tenant app**: `pnpm --filter tenant dev` — runs on port 3002. Use `?tenant=skull` for local tenant resolution.
- **Platform app**: `pnpm --filter platform dev` — runs on port 3000.
- **API**: `pnpm --filter api dev` — runs on port 3001.

### Local dev without running the API (Option B)

By default, tenant and platform proxy `/api/v1/**` to the live API at `https://api.dguild.org`. The browser makes same-origin requests, so no CORS or localhost in production CORS. Auth cookies work.

No env vars needed. Just run `pnpm --filter tenant dev` or `pnpm --filter platform dev`.

### Local dev with local API

Set `NUXT_PUBLIC_API_URL=http://localhost:3001` so the client fetches the local API directly. The local API includes localhost in its default CORS.

### Env vars

Copy `apps/api/.env.example` to `apps/api/.env` for the API. For tenant/platform:

| Var | Used by | Purpose |
|-----|---------|---------|
| `NUXT_PUBLIC_API_URL` | tenant, platform | API base URL. Unset in dev = use proxy to live API. Set to `http://localhost:3001` for local API. |
| `NUXT_PUBLIC_API_PROXY_TARGET` | tenant, platform | Proxy target when using proxy. Default: `https://api.dguild.org`. |
| `NUXT_PUBLIC_HELIUS_RPC` | tenant, platform | Full Helius RPC URL for client (wallet tx, DAS). Baked into build. |

For the API:

| Var | Used by | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | API | Postgres connection. Optional for local; without it, API uses file-based tenant config only. |
| `TENANT_CONFIG_PATH` | API | Path to `configs/tenants/`. Default: `configs/tenants` for monorepo. |
| `HELIUS_RPC_URL` | API | Full Helius RPC URL (with api-key). For server-side Solana/DAS. |

### Local tenant resolution

- **Host**: `localhost` or `127.0.0.1`
- **Query**: `?tenant=skull` → slug = `skull`

## GitHub secrets (for deploy workflows)

Add these in **Settings > Secrets and variables > Actions**:

| Secret | Used by | Purpose |
|--------|---------|---------|
| `NUXT_PUBLIC_API_BASE_URL` | tenant, platform | API URL baked into static build |
| `NUXT_PUBLIC_HELIUS_RPC` | tenant, platform | Helius RPC for client (wallet, DAS) |

Never commit these values. `.env` is gitignored.

---

## Staging / production

- **Deployment**: Tenant + platform → static builds → GitHub Pages. API → Railway.
- **Subdomains**: `{slug}.decentraguild.com` → tenant slug from subdomain.
- **Fallback**: If subdomains are complex, use path-based: `dguild.org/app/{slug}`.

## Build-time vars

For Nuxt apps deployed to GitHub Pages:

- `NUXT_PUBLIC_API_URL` (or `NUXT_PUBLIC_API_BASE_URL`) must be set at build time.
- `NUXT_PUBLIC_HELIUS_RPC` – Helius RPC for client; add as GitHub secret.
- Add as GitHub Actions secrets; never commit `.env` or keys to the repo.
