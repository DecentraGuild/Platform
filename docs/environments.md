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
| `CORS_ORIGIN` | API | Comma-separated origins. Include localhost for local dev. |

### Local tenant resolution

- **Host**: `localhost` or `127.0.0.1`
- **Query**: `?tenant=skull` → slug = `skull`

## GitHub secrets (deploy)

| Secret | Purpose |
|--------|---------|
| `NUXT_PUBLIC_API_BASE_URL` | API URL in static build |
| `NUXT_PUBLIC_HELIUS_RPC` | Helius RPC for client |

## Deployment

- **Platform**: Static build → Netlify (dguild.org). Uses `netlify.toml`.
- **Tenant**: Static build → Netlify (*.dguild.org). Uses `netlify-tenant.toml` — set "Config file path" to `netlify-tenant.toml` in Netlify Build settings.
- **API**: Railway.
- **Subdomains**: `{slug}.dguild.org` → tenant slug.

### Netlify setup

1. Create two Netlify sites from the same repo.
2. **Platform site**: Base directory empty (repo root). Netlify uses `netlify.toml` by default.
3. **Tenant site**: Base directory empty. In Build settings, set **Config file path** to `netlify-tenant.toml`.
4. Add env vars (Build settings > Environment): `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_HELIUS_RPC`.
