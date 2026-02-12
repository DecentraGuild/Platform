# Environments

## Local development

- **Tenant app**: `pnpm --filter tenant dev` — runs on port 3000. Use `?tenant=skull` for local tenant resolution.
- **Platform app**: `pnpm --filter platform dev` — runs on port 3000 (or next available).
- **API**: `pnpm --filter api dev` — runs on port 3001.

### Env vars

Copy `.env.example` to `.env` (or `.env.local`) and fill values:

| Var | Used by | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | API | Postgres connection. Optional for local; without it, API uses file-based tenant config only. |
| `TENANT_CONFIG_PATH` | API | Path to `configs/tenants/` for file fallback. Default: `configs/tenants`. For monorepo, use `../../configs/tenants` when API cwd is `apps/api`. |
| `NUXT_PUBLIC_API_URL` | tenant, platform | API base URL. Default: `http://localhost:3001`. |
| `HELIUS_RPC_URL` | API | Full Helius RPC URL (with api-key). For server-side Solana/DAS. |
| `NUXT_PUBLIC_HELIUS_RPC` | tenant, platform | Full Helius RPC URL for client (wallet tx, DAS). Baked into build. |

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
