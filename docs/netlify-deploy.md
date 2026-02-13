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

## DNS for tenant subdomains (e.g. skull.dguild.org)

**DNS_PROBE_FINISHED_NXDOMAIN** means the subdomain has no DNS record. Add one of:

- **Per subdomain:** Create a CNAME (or A) for each tenant, e.g. `skull.dguild.org` → your tenant Netlify hostname (e.g. `dapp.netlify.app` or the Netlify-provided URL). In Netlify, add the custom domain `skull.dguild.org` to the tenant site and follow Netlify’s DNS instructions.
- **Wildcard:** CNAME `*.dguild.org` → tenant Netlify hostname. Then every `*.dguild.org` resolves to the tenant app; the app derives the slug from the subdomain (e.g. `skull.dguild.org` → slug `skull`).

## Netlify “Site not found” on skull.dguild.org (DNS works, Netlify 404)

If DNS is correct but you get Netlify’s **“Site not found”** / **“Looks like you followed a broken link”** (with a Netlify Internal ID), the hostname is reaching **a different Netlify site** than the one that serves the tenant app, or a site with no deploy.

- You must have **one** Netlify site that builds the tenant app (Package directory = `apps/tenant`). That site should already serve **dapp.dguild.org** (or your main tenant URL).
- **skull.dguild.org** and any other `*.dguild.org` subdomains must be **custom domains on that same tenant site**. Do not add skull.dguild.org to a second/empty Netlify site.
- **In Netlify:** Open the **tenant** site (the one where dapp.dguild.org works). Go to **Domain management** (or **Domain settings**). Add **skull.dguild.org** as a custom domain on this site. If you use a wildcard, add **\*.dguild.org** (and optionally **dguild.org** if you want the apex). All of these must be on the **same** site that has the successful tenant deploy.
- If skull.dguild.org was added to another site (e.g. a separate “skull” site), remove it from there and add it to the tenant site. The tenant app is a single deploy; subdomains only change the slug (skull vs dapp), they do not use different Netlify sites.

## API URL and 404s

- **Double slash (e.g. `https://api.dguild.org//api/v1/...`):** Caused by `NUXT_PUBLIC_API_URL` having a trailing slash. The app normalizes at build time and at runtime; set the env var in Netlify to `https://api.dguild.org` with **no** trailing slash. After redeploy, requests use a single slash.
- **404 on `/api/v1/tenant-context?slug=skull` (or `slug=dapp`):** The API returns 404 when that tenant slug is not found (no DB row and no file under `configs/tenants/<slug>.json`). On Railway, ensure the API has tenant config (e.g. `TENANT_CONFIG_PATH` or DB seeded). For `dapp.dguild.org` the slug is `dapp`; if you only have a `skull` tenant, use `dapp.dguild.org/?tenant=skull` or add a tenant config for `dapp`.

## CORS (API): add every front-end origin

If the browser shows **"blocked by CORS policy: No 'Access-Control-Allow-Origin' header"** when calling the API from `skull.dguild.org` (or another subdomain), the API’s `CORS_ORIGIN` does not include that origin.

- On **Railway** (or wherever the API runs), set **CORS_ORIGIN** to a comma-separated list of **every** URL that hosts the platform or tenant app: platform (e.g. `https://dguild.org`), and **each** tenant subdomain (e.g. `https://dapp.dguild.org`, `https://skull.dguild.org`). No trailing slashes.
- Example: `https://dguild.org,https://dapp.dguild.org,https://skull.dguild.org,http://localhost:3000,http://localhost:3002`
- After changing CORS_ORIGIN, redeploy or restart the API.
