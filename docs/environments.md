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

- **Tenant + platform**: Static build → GitHub Pages.
- **API**: Railway.
- **Subdomains**: `{slug}.decentraguild.com` → tenant slug.
