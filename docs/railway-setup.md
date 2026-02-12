# Railway Setup Manual

This guide walks through setting up the DecentraGuild API and Postgres database on Railway.

---

## Prerequisites

- A [Railway](https://railway.app) account (GitHub login)
- The DecentraGuild repo pushed to GitHub
- A GitHub account linked to Railway

---

## Step 1: Create a New Project

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select your DecentraGuild repository (or connect GitHub if needed).
5. Choose the branch to deploy (e.g. `main`).

---

## Step 2: Add Postgres

1. In your project dashboard, click **+ New**.
2. Select **Database**.
3. Choose **PostgreSQL**.
4. Wait for the database to provision.
5. Click the Postgres service. In the **Variables** tab, you will see `DATABASE_URL`. Copy it; you will use it for the API.

---

## Step 3: Configure the API Service

1. Railway may have auto-detected your repo. If not, click **+ New** and choose **GitHub Repo**. Select the same DecentraGuild repo.
2. In the new service, go to **Settings**:
   - **Root Directory**: `apps/api`
   - **Build Command**: `pnpm install && pnpm --filter api build`
   - **Start Command**: `node dist/index.js`
   - **Watch Paths**: `apps/api`

   If Root Directory is not supported, use a monorepo setup (see Step 4).

3. Go to **Variables** and add:

   | Variable        | Value                                                                 |
   |-----------------|-----------------------------------------------------------------------|
   | `DATABASE_URL`  | Paste the Postgres `DATABASE_URL` from Step 2 (or use Railway’s reference) |
| `PORT`          | Railway sets this automatically; only add if you need an override   |
| `NODE_ENV`      | `production`                                                          |
| `HELIUS_RPC_URL`| Full Helius RPC URL for server-side Solana/DAS (optional for now)   |

4. **Link the database** (optional but recommended):
   - In the API service, open **Variables**.
   - Click **New Variable** → **Add Reference**.
   - Choose the Postgres service and select `DATABASE_URL`. Railway will inject it automatically.

---

## Step 4: Monorepo Build Settings

Because DecentraGuild is a pnpm monorepo, Railway must build from the repo root:

1. **Root Directory**: Leave empty or `/`.
2. **Build Command**: `pnpm install && pnpm --filter api build`
3. **Start Command**: `pnpm --filter api start` or `node apps/api/dist/index.js`
4. **Output Directory**: Ensure the build outputs to `apps/api/dist` (tsup default for the API).

If using Nixpacks or Buildpacks, set a custom start command:

- `cd apps/api && node dist/index.js`

---

## Step 5: Run Migrations

The API runs migrations on startup when `DATABASE_URL` is set. The `001_tenant_config.sql` migration creates the `tenant_config` table.

If you prefer to run migrations manually:

1. Install the Railway CLI: `npm i -g @railway/cli`
2. Link the project: `railway link`
3. Run SQL via `railway run` or connect with any Postgres client using `DATABASE_URL`.

---

## Step 6: Deploy and Verify

1. Push to the connected branch (e.g. `main`) or trigger a deploy from the Railway dashboard.
2. When the build finishes, Railway will assign a public URL (e.g. `https://your-api.up.railway.app`).
3. Test the health endpoint: `curl https://your-api.up.railway.app/api/v1/health`
4. Test tenant context: `curl "https://your-api.up.railway.app/api/v1/tenant-context?slug=skull"`

---

## Step 7: Custom Domain (Optional)

1. In the API service, go to **Settings** → **Domains**.
2. Click **Custom Domain** and add `api.decentraguild.com` (or your preferred subdomain).
3. Add the CNAME record Railway provides to your DNS.
4. Update `NUXT_PUBLIC_API_URL` or `NUXT_PUBLIC_API_BASE_URL` in your frontend deployments to use this URL.

---

## Environment Variables Reference

| Variable            | Required | Used by | Description                                        |
|---------------------|----------|---------|----------------------------------------------------|
| `DATABASE_URL`      | Yes*     | API     | Postgres connection string. Required for DB and PATCH. |
| `PORT`              | No       | API     | Railway sets this.                                 |
| `TENANT_CONFIG_PATH`| No       | API     | Path to `configs/tenants`. Fallback when no DB.   |

\* Without `DATABASE_URL`, the API runs in file-only mode: tenant config is read from JSON files; PATCH and POST tenants return 503.

---

## Troubleshooting

**Build fails with "pnpm not found"**

- Add a `nixpacks.toml` or ensure the buildpack uses Node + pnpm. Or add a `package.json` script that Railway can detect.

**API crashes on startup**

- Check logs: Railway Dashboard → API service → **Deployments** → select deployment → **View Logs**.
- Ensure `DATABASE_URL` is set and reachable.
- Confirm the migration runs (check for `tenant_config` in the database).

**Tenant context returns 404**

- Without DB, config is loaded from files. Ensure `configs/tenants/skull.json` is present in the repo.
- With DB, the seed runs on startup; if the DB was empty, Skull & Bones should be inserted from the JSON file.
