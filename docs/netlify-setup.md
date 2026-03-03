# Netlify setup (tenant + platform)

Two separate Netlify sites deploy from this repo. Each must use its **own base directory** so it picks up the correct `netlify.toml` and builds the right app.

For a full checklist when tenant shell fails to load (e.g. "Site not found" or "Tenant not found"), see [tenant-publish-checklist.md](tenant-publish-checklist.md).

## 1. Tenant site (*.dguild.org)

- **Base directory (required):** In Netlify → Site settings → Build & deploy → Build settings, set **Base directory** to `apps/tenant`. If this is empty or wrong, Netlify uses the repo root and looks for `.output/public` at the root (it does not exist there; the tenant app outputs to `apps/tenant/.output/public`), and the deploy fails with "Deploy directory '.output/public' does not exist".
- Netlify will then use `apps/tenant/netlify.toml` (build: `pnpm run build:tenant`, publish: `.output/public`).
- **Full repo required:** Netlify must clone the full monorepo. The build command `pnpm run build:tenant` is defined in the **root** `package.json`; with base directory `apps/tenant`, pnpm resolves it from the workspace root. If the repo is not fully cloned, the build will fail.
- **Build env (production):** In Netlify → Site → Environment variables (Build), set:
  - `NUXT_PUBLIC_API_URL` – API base URL with no trailing slash (e.g. `https://api.dguild.org`). Required so the tenant app calls the correct API for tenant context, auth, marketplace, etc.
  - `NUXT_PUBLIC_HELIUS_RPC` – Optional but required for marketplace features.
- **Custom domains:** Add `*.dguild.org` or each tenant subdomain (e.g. `skull.dguild.org`) to **this same site** in Domain management. "Site not found" on a subdomain means that host is not served by this site.
- **SPA fallback:** The tenant app ships `public/_redirects` (`/* /200.html 200`) so Netlify serves the SPA for all routes. No extra config needed.

## 2. Platform site (www.dguild.org / dguild.org)

- **Base directory:** `apps/platform`
- Netlify will use `apps/platform/netlify.toml` (build: `pnpm run build:platform`, publish: `.output/public`).
- **Build env:** Set `NUXT_PUBLIC_API_URL` (and optionally `NUXT_PUBLIC_TENANT_BASE_DOMAIN`, `NUXT_PUBLIC_HELIUS_RPC`) so the platform uses the same API and correct tenant base domain for Visit links.

## Do not

- Use a single root `netlify.toml` for both sites (both would build the same app).
- Leave Base directory empty or set to `.` for both (then both would use the same config).

## After changing Base directory or env

Redeploy both sites so they use the correct app and env. If you change `NUXT_PUBLIC_API_URL` or other build env, trigger a new deploy (optionally "Clear cache and deploy") so the built bundle has the right values.
