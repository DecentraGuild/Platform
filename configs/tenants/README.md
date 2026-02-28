# Tenant configs (static JSON)

Registry of dGuild configs. One file per tenant: `{id}.json`. Lookup by id or slug. See `configs/README.md` for conventions.

**Only the API reads these files.** Other apps (platform, tenant) get tenant data via the API:

- `GET /api/v1/tenant-context?slug=...` – single tenant
- `GET /api/v1/tenants` – list (from DB if present, else from this folder)

The API resolves the folder via `TENANT_CONFIG_PATH` (set at startup when run from the monorepo). No DB is required for static config; the API serves from this directory when the DB is empty or a slug is not in the DB.
