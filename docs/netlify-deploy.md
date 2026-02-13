# Netlify deployment (platform + tenant)

Two separate Netlify sites deploy from this repo. Each site uses its own `netlify.toml` inside its app directory. There is no root `netlify.toml`.

## Config layout

- **apps/platform/netlify.toml** — platform app (Build Your Own, Discover dGuilds, Create org). Used when Package directory = `apps/platform`.
- **apps/tenant/netlify.toml** — tenant app (dGuild shell, Admin, modules). Used when Package directory = `apps/tenant`.

Netlify looks for `netlify.toml` in this order: Package directory → Base directory → Root. So each site must have **Package directory** set to the correct app; otherwise Netlify finds no config (root is empty).

## Netlify UI (per site)

1. Create two Netlify sites from the same repo.
2. **Platform site**: Build settings → **Package directory** = `apps/platform`. Leave Base directory empty.
3. **Tenant site**: Build settings → **Package directory** = `apps/tenant`. Leave Base directory empty.
4. Add env vars (Build settings > Environment): `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_HELIUS_RPC`.
5. Node version: `.nvmrc` (20) and `NODE_VERSION` in each app’s netlify.toml.

## How to confirm which app is served

- **Platform:** Home says "Build Your Own", with "Discover dGuilds" and "Create org". Header shows "DecentraGuild" and those two links.
- **Tenant:** Home shows a tenant name (or "dGuild") and an Admin button when the tenant has admin module. Header/nav are the tenant shell (AppShell, module links).

## Tenant slug on Netlify URLs

Tenant resolution is by **host**: the code expects `*.dguild.org` (e.g. `skull.dguild.org` → slug `skull`). See `packages/core/src/resolver.ts`.

- On **custom domain** with subdomains: point `skull.dguild.org` (and other tenant subdomains) to the **tenant** Netlify site; the resolver will return the slug from the subdomain.
- On **dguild.netlify.app** (no subdomain): the resolver returns no slug, so the tenant app loads with no tenant (empty nav / error). Use `?tenant=skull` to test, e.g. `https://dguild.netlify.app/?tenant=skull`.
