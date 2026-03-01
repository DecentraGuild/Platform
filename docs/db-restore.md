# Database restore from R2 backup

How to restore the Postgres database from a backup stored in Cloudflare R2. Use this when recovering from data loss, migrating to a new DB, or testing restore.

---

## Backup location

| Where | Path |
|-------|------|
| **R2 bucket** | `dguildbackup` (or value of `BACKUP_BUCKET`) |
| **Object key** | `backups/db-YYYY-MM-DD.dump` (one per day) |
| **Format** | PostgreSQL custom format (`-Fc`), compressed |

Backups are created daily by the worker. Check R2 dashboard or use AWS CLI/SDK to list objects.

---

## Prerequisites

- `pg_restore` (from PostgreSQL client tools). On Windows: install PostgreSQL or use WSL. On macOS: `brew install libpq` or use PostgreSQL app.
- Access to download from R2: either Cloudflare dashboard download, or AWS CLI with R2 credentials.
- A Postgres database to restore into (empty or to overwrite).
- `DATABASE_URL` or connection details for the target database.

---

## Step 1: Download the backup

### Option A: Cloudflare dashboard

1. Log in to Cloudflare Dashboard → R2 → your bucket (`dguildbackup`).
2. Open the `backups/` folder.
3. Download the desired file (e.g. `db-2025-03-01.dump`).

### Option B: AWS CLI (R2-compatible)

```bash
# Configure R2 as S3 endpoint (one-time)
export AWS_ACCESS_KEY_ID="your_r2_access_key"
export AWS_SECRET_ACCESS_KEY="your_r2_secret_key"

# Download (replace bucket and date)
aws s3 cp s3://dguildbackup/backups/db-2025-03-01.dump ./db-2025-03-01.dump \
  --endpoint-url https://c4bca857ae3a03d942fa638b2d82f03f.r2.cloudflarestorage.com
```

---

## Step 2: Restore into database

### Restore into a fresh database

```bash
# Set target connection string (new/empty database)
export TARGET_DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Restore (creates tables and data)
pg_restore -Fc -d "$TARGET_DATABASE_URL" ./db-2025-03-01.dump
```

### Restore and replace existing data (drop + recreate)

```bash
# WARNING: Drops existing objects. Use only when intentionally overwriting.
pg_restore -Fc -d "$TARGET_DATABASE_URL" --clean --if-exists ./db-2025-03-01.dump
```

### Restore with verbose output

```bash
pg_restore -Fc -d "$TARGET_DATABASE_URL" -v ./db-2025-03-01.dump
```

---

## Step 3: Verify

1. Connect to the database and spot-check critical tables:
   ```sql
   SELECT COUNT(*) FROM tenant_config;
   SELECT COUNT(*) FROM billing_payments WHERE status = 'confirmed';
   SELECT COUNT(*) FROM wallet_discord_links;
   ```
2. Point the API at the restored DB (`DATABASE_URL`) and restart.
3. Test tenant context, admin, and a core flow (e.g. marketplace or Discord verify).

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `pg_restore: error: connection to database failed` | Wrong URL, SSL, or network | Check `TARGET_DATABASE_URL`, SSL mode, firewall. |
| `role "xxx" does not exist` | DB user differs from backup | Create the role or use `-U` / connection user that exists. |
| `relation already exists` | Tables exist in target | Use `--clean --if-exists` to drop first, or restore into an empty DB. |
| Download fails from R2 | No access / wrong creds | Verify R2 API token has Object Read for the bucket. |

---

## When to test restore

- After setting up backups for the first time.
- After major schema changes (ensure backup format is still valid).
- Periodically (e.g. quarterly) as part of disaster-recovery drills.
