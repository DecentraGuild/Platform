# Database migrations

Single consolidated schema in `001_initial.sql`. Fresh deploys run this only; no incremental migrations.

**Full reset (empty DB):** From `apps/api`, run `pnpm run db:clear` to truncate all tenant and app data. Then restart the API; 001 runs and recreates schema as needed.
