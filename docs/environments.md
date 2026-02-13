# Environments

## Local development

- **Tenant app**: `pnpm --filter tenant dev` — port 3002. Use `?tenant=skull` for local tenant.
- **Platform app**: `pnpm --filter platform dev` — port 3000.
- **API**: `pnpm --filter api dev` — port 3001.

### Env vars

| Var | Used by | Purpose |
|-----|---------|---------|
| `NUXT_PUBLIC_API_URL` | tenant, platform | API URL. Default: `https://api.dguild.org`. Set `http://localhost:3001` for local API. |
| `NUXT_PUBLIC_HELIUS_RPC` | tenant, platform | Helius RPC for client (wallet, DAS). |
| `DATABASE_URL` | API | Postgres. Railway provides via Add Reference. |
| `SESSION_SECRET` | API | Min 32 chars. Generate: `openssl rand -base64 32`. |
| `CORS_ORIGIN` | API | Comma-separated origins. Include platform domain and **every** tenant subdomain (e.g. `https://dapp.dguild.org`, `https://skull.dguild.org`) plus localhost for dev. |

### Local tenant resolution

- **Host**: `localhost` or `127.0.0.1`
- **Query**: `?tenant=skull` → slug = `skull`

## GitHub secrets (deploy)

| Secret | Purpose |
|--------|---------|
| `NUXT_PUBLIC_API_BASE_URL` | API URL in static build |
| `NUXT_PUBLIC_HELIUS_RPC` | Helius RPC for client |

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
