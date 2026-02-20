# Database migrations and health check – implementation guide

This document describes two improvements for an agent (or developer) to implement: **versioned DB migrations** and **health check including DB connectivity**. Current state and target behaviour are below.

---

## 1. Database migrations (current vs target)

### Current state

- Migrations live **inline in `apps/api/src/index.ts`** as string constants (`MIGRATION_001` … `MIGRATION_006`).
- On startup, when `DATABASE_URL` is set, the API runs them in a fixed order with `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- There is **no migration history table** and no record of which migrations have already been applied.
- Adding a new migration means appending a new constant and adding it to the loop; rollback or reordering is error-prone.

### Target behaviour

- **Versioned migrations**: Move SQL into a dedicated folder (e.g. `apps/api/src/db/migrations/`) with timestamped or numbered files (e.g. `001_tenant_config.sql`, `002_mint_metadata.sql`, …).
- **Migration history**: A table (e.g. `schema_migrations`) storing which migration ids/names have been applied and when.
- **Runner**: A small runner that (on API startup or via a separate script):
  - Reads the migrations directory.
  - Compares with `schema_migrations`.
  - Runs only **new** migrations in order.
  - Records each applied migration in `schema_migrations`.
- **No double-apply**: Idempotent SQL (e.g. `IF NOT EXISTS`) can remain for safety, but the runner ensures each migration file is applied at most once.
- **Rollback**: Optional later: support down-migrations or document manual rollback steps; not required for the first iteration.

### Implementation notes

- Preserve the **current DDL** (tables, indexes, columns) when extracting to files; do not change behaviour.
- Ensure the pool is initialized before running migrations (same as today).
- On failure, log and either exit or surface clearly so deploy fails fast; do not leave the DB half-migrated without a clear error.

---

## 2. Health check including DB (current vs target)

### Current state

- `GET /api/v1/health` checks only **tenant config** (e.g. that `loadTenantBySlug('skull')` works).
- It does **not** check database connectivity.
- If `DATABASE_URL` is wrong or the DB is down, the health endpoint can still return 200 while other routes that use `query()` return 500.

### Target behaviour

- When **`DATABASE_URL` is set**, the health handler should **verify DB connectivity** (e.g. `SELECT 1` or a trivial query via the existing `query()` helper).
- Include a field in the JSON response, e.g. `database: 'ok'` or `database: 'error'` (and optionally a short message), so deploy and monitoring can see DB status.
- When `DATABASE_URL` is **not** set (e.g. minimal local run without DB), health can report `database: null` or `database: 'skipped'` and still return 200 if tenant config is ok.
- Keep the response small and safe for public exposure (no connection strings or internal details).

### Implementation notes

- Use the existing `getPool()` / `query()` from `apps/api/src/db/client.js`. If the pool is not initialized, treat as `database: 'skipped'` or `database: null`.
- On query failure, set `database: 'error'` and optionally return 503 for health so load balancers can mark the instance unhealthy, or keep 200 and let the consumer decide from the payload.

---

## Summary for the implementing agent

| Item | Location | Goal |
|------|----------|------|
| Versioned migrations | `apps/api/src/db/migrations/` + runner + `schema_migrations` table | Replace inline migrations in `index.ts` with a migration runner that applies each file once and records it. |
| Health + DB | `apps/api/src/index.ts` – `GET /api/v1/health` | When DB is configured, run a trivial query and report `database: 'ok'` or `database: 'error'` in the health response. |

After implementation, remove or refactor the inline `MIGRATION_*` constants and `runMigrations()` in `index.ts` so that startup uses the new migration runner instead.
