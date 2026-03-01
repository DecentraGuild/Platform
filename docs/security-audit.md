# Security notes

Summary of security measures in place for the DecentraGuild platform.

## Input validation

- **Tenant slug/ID:** All tenant identifiers from client (URL, body) are validated via `isValidTenantSlug`, `isValidTenantIdentifier`, and `normalizeTenantIdentifier` before use in paths or DB. See `apps/api/src/validate-slug.ts`.
- **Path traversal:** Slug validation rejects `..` and restricts to subdomain-safe characters.
- **DB queries:** Parameterized queries used throughout; no raw string interpolation of user input.

## Rate limiting

- **Global:** `@fastify/rate-limit` (configurable via `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`).
- **Strict limits (in-memory, per IP):**
  - Auth routes (`/auth/nonce`, `/auth/verify`): `RATE_LIMIT_AUTH_MAX` (default 10)
  - Tenant creation: `RATE_LIMIT_TENANT_CREATE_MAX` (default 5)
  - Discord verify: `RATE_LIMIT_DISCORD_VERIFY_MAX` (default 20)
  - Admin write (settings, Discord rules, billing): `RATE_LIMIT_ADMIN_WRITE_MAX` (default 60)

See `apps/api/.env.example` for env var names and defaults.

## Error handling and debug

- **Stack traces:** Exposed only when `NODE_ENV !== 'production'`. Production error responses do not leak stack traces.
- **Secrets:** No API keys, passwords, or tokens in code. Configuration from env; `.env` gitignored.

## CORS

- Production origins from `CORS_ORIGIN`. Tenant subdomains allowed dynamically via `CORS_TENANT_DOMAIN` (default `.dguild.org`).

## Discord bot

- Server-to-server auth via `x-bot-secret` header. Bot does not handle wallet or user secrets.
- Verify sessions and wallet links use token-based flow; tokens are short-lived and single-use where appropriate.

## Dependency vulnerabilities

Run `pnpm audit` periodically. Transitive vulnerabilities (e.g. in `@solana/spl-token` deps, Nuxt/nitropack deps) may appear; address high/critical where patches exist. Test coverage: one automated test (`apps/api/src/discord/rule-engine.test.ts`); critical paths (auth, billing, Discord sync) flagged for future tests.
