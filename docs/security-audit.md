# Security audit (build and abuse)

Summary of findings and fixes from a build/security pass. Focus: API, auth, tenant resolution, and config handling.

---

## Fixed (implemented)

### 1. Tenant takeover via POST /api/v1/tenants (critical)

**Issue:** Any authenticated wallet could overwrite an existing tenant by calling `POST /api/v1/tenants` with an existing slug. The handler used `upsertTenant`, so e.g. `{ "slug": "skull", "name": "Skull" }` would replace the existing tenant and set `admins: [attackerWallet]`.

**Fix:** Tenant creation now only allows **new** slugs. If a tenant with that slug already exists (in DB or in file config), the API returns `409 Conflict` and does not update. New tenants still require an authenticated wallet and valid slug.

### 2. Path traversal via tenant slug (high)

**Issue:** Tenant slug was used in `path.join(dir, \`${slug}.json\`)` in registry, marketplace-registry, and scope without validation. A slug like `../other/skull` or `..\\..\\etc\\passwd` could read or write outside the config directory.

**Fix:** Added `validate-slug.ts` with `isValidTenantSlug` and `normalizeTenantSlug`. Slug must match `[a-z0-9][a-z0-9-]*[a-z0-9]` or single `[a-z0-9]`, 1–64 chars, no `..`. All file and route handlers that use slug from the client now validate (and normalize to lowercase) before using it in paths or DB.

---

## Already in good shape

- **Session:** JWT (HS256), min 32-char secret; in production no default secret (throws if missing). Cookie httpOnly, SameSite, secure when `x-forwarded-proto === 'https'`.
- **CORS:** Dynamic allowlist (explicit origins + `https://<slug>.<CORS_TENANT_DOMAIN>`). Localhost only when `NODE_ENV !== 'production'`.
- **Auth flow:** Nonce per wallet, consumed on verify; Ed25519 signature verification for wallet + message.
- **SQL:** Parameterized queries throughout; no concatenation of user input into SQL.
- **Debug routes:** `/api/v1/debug/*` return 404 in production (`NODE_ENV === 'production'`). Scope expand is also disabled in production.
- **Admin actions:** Tenant and marketplace settings require `requireTenantAdmin` (wallet in `tenant.admins`).

---

## Recommendations (not implemented)

### Rate limiting

- **Auth:** `/api/v1/auth/nonce` and `/api/v1/auth/verify` have no rate limit. A client could request many nonces or attempt many verifications. Mitigation: add rate limiting (e.g. by IP or wallet) for auth and/or global for the API.
- **Tenant creation:** `POST /api/v1/tenants` is auth-only; rate limiting would reduce abuse (e.g. slug squatting or spam orgs).

### GET /api/v1/tenants

- Unauthenticated; returns all tenants (id, slug, name, branding, modules, etc.). If tenant list is intended to be public for discovery, this is fine. If not, consider requiring auth or restricting fields.

### Tenant context slug source

- `/api/v1/tenant-context` accepts slug from query (`?slug=`) or from Host. So any client can request context for any slug (e.g. `?slug=skull`). That allows enumerating tenant configs without visiting subdomains. If that’s acceptable (e.g. for SSR or mobile), no change. If you want strict “tenant from Host only” in production, you could ignore `?slug=` when not on localhost.

### Production checklist

- Set `NODE_ENV=production`.
- Set `SESSION_SECRET` (or `JWT_SECRET`) to a strong value (e.g. `openssl rand -base64 32`); never use the dev default in prod.
- Ensure `DATABASE_URL` is set and not exposed (e.g. in client bundles or logs).
- Ensure debug and scope-expand are not reachable (they are gated by `NODE_ENV === 'production'`).

---

## Files touched (security fixes)

- `apps/api/src/validate-slug.ts` (new)
- `apps/api/src/routes/tenants.ts` – create-only, slug validation/normalization
- `apps/api/src/routes/tenant-context.ts` – slug normalization/validation
- `apps/api/src/routes/tenant-settings.ts` – slug validation in `requireTenantAdmin`, use `result.tenant.slug` after auth
- `apps/api/src/routes/marketplace-scope.ts` – slug validation
- `apps/api/src/routes/marketplace-escrows.ts` – slug validation
- `apps/api/src/routes/marketplace-metadata.ts` – slug validation
- `apps/api/src/config/registry.ts` – slug validation in load/write/diagnostic
- `apps/api/src/config/marketplace-registry.ts` – slug validation in load/write
- `apps/api/src/marketplace/scope.ts` – slug validation in scope file path and entry access
