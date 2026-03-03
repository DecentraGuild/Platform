# Netlify setup (tenant + platform)

Two separate Netlify sites deploy from this repo. Each must use its **own base directory** so it picks up the correct `netlify.toml` and builds the right app.

## 1. Tenant site (*.dguild.org)

- **Base directory:** `apps/tenant`
- Netlify will use `apps/tenant/netlify.toml` (build: `pnpm run build:tenant`, publish: `.output/public`).
- **Required env (production):** set `NUXT_PUBLIC_API_URL` to your API base URL with no trailing slash (e.g. `https://api.dguild.org` or your Railway API URL). The tenant app calls this for tenant context, auth, marketplace, raffles, etc. If this is wrong or missing, tenants like skull.dguild.org will fail to load (missing API).

## 2. Platform site (www.dguild.org / dguild.org)

- **Base directory:** `apps/platform`
- Netlify will use `apps/platform/netlify.toml` (build: `pnpm run build:platform`, publish: `.output/public`).

## Do not

- Use a single root `netlify.toml` for both sites (both would build the same app).
- Leave Base directory empty or set to `.` for both (then both would use the same config).

## After changing Base directory

Redeploy both sites so they use the correct app. Then set `NUXT_PUBLIC_API_URL` on the **tenant** site to your live API URL and redeploy the tenant once.
