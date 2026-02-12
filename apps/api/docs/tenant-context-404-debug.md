# Tenant context 404 – request path and how to fix

## End-to-end path

1. **Tenant app (localhost:3002)**  
   - Plugin `tenant.client.ts` runs on load.  
   - Slug comes from `?tenant=skull` or, on localhost with no param, default `skull`.  
   - Store calls `fetchTenantContext('skull')`.

2. **Store** (`apps/tenant/src/stores/tenant.ts`)  
   - Builds URL: `config.public.apiUrl + '/api/v1/tenant-context?slug=skull'`.  
   - `apiUrl` from `nuxt.config.ts`: `process.env.NUXT_PUBLIC_API_URL ?? 'http://localhost:3001'`.  
   - So requested URL: **`GET http://localhost:3001/api/v1/tenant-context?slug=skull`**.

3. **API (localhost:3001)**  
   - Route: `GET /api/v1/tenant-context` in `apps/api/src/routes/tenant-context.ts`.  
   - Reads `slug` from query → `slug = 'skull'`.  
   - Tries, in order:  
     - If `DATABASE_URL` is set: load from DB via `getTenantBySlug('skull')`.  
     - Else or if not in DB: load from static config via `loadTenantBySlug('skull')` (reads `TENANT_CONFIG_PATH/skull.json`).  
   - If both are null → **404** with `{ error: '...' }`.

4. **Registry** (`apps/api/src/config/registry.ts`)  
   - `loadTenantBySlug('skull')`:  
     - `getTenantConfigDir()` → `process.env.TENANT_CONFIG_PATH` resolved with `path.resolve`.  
     - If null → returns null (no config dir).  
     - Else builds path `path.join(dir, 'skull.json')`, then `readFile`, `JSON.parse`, and checks `id`, `slug`, `name`, `modules`.  
   - If any step fails (no dir, file missing, bad JSON, or validation) → returns null → route returns 404.

5. **Where `TENANT_CONFIG_PATH` is set**  
   - In `apps/api/src/index.ts`, before starting the server:  
     - `ensureTenantConfigPath()` runs.  
     - If `TENANT_CONFIG_PATH` is already set (e.g. env), it is left as is.  
     - Else: from `apps/api/src/index.ts` we resolve `../../../configs/tenants` (repo root `configs/tenants`), check that `skull.json` exists there, and set `process.env.TENANT_CONFIG_PATH` to that directory.

So a 404 on `tenant-context?slug=skull` means either:

- The request never reaches the API (wrong URL, API not running, or something else answering on 3001), or  
- The API runs but both DB (if used) and `loadTenantBySlug('skull')` return null: wrong/missing `TENANT_CONFIG_PATH`, file missing, read/parse error, or config validation failure.

## How to see the exact cause

1. **Debug endpoint**  
   Open in the browser (or with curl):
   ```text
   http://localhost:3001/api/v1/debug/tenant-config?slug=skull
   ```
   Response shows:
   - `tenantConfigPath` – value of the config directory (or null).  
   - `filePath` – full path to `skull.json`.  
   - `fileExists` – whether that file exists on disk.  
   - `error` – message if something failed (e.g. ENOENT, parse error, or validation).  
   - `config` – the loaded config if successful, else null.

2. **404 with details**  
   Call tenant-context with `debug=1`:
   ```text
   http://localhost:3001/api/v1/tenant-context?slug=skull&debug=1
   ```
   If the API returns 404, the body includes a `diagnostic` object with the same fields as above.

3. **Tenant app**  
   On 404, the tenant store shows the `error` from the API response. If we include the diagnostic error in the 404 body, that message appears in the red banner (e.g. "ENOENT: ..." or "Config missing required fields...").

## Typical fixes

- **`TENANT_CONFIG_PATH` not set**  
  Start the API from the repo root or from `apps/api` so that `ensureTenantConfigPath()` can resolve `configs/tenants`. Or set `TENANT_CONFIG_PATH` in the environment to the full path of the directory that contains `skull.json`.

- **`fileExists: false`**  
  The path is wrong or the file is missing. Check the `filePath` in the debug response; ensure `configs/tenants/skull.json` exists there (or set `TENANT_CONFIG_PATH` to the directory that actually contains it).

- **`error` about JSON or “required fields”**  
  Fix `skull.json`: valid JSON and required fields `id`, `slug`, `name`, and `modules` (array). Optionally `admins` (array); if missing it is defaulted.

- **404 but API not running**  
  Start the API (`pnpm --filter api dev`) and ensure nothing else is bound to port 3001.

- **404 from another process**  
  If something else (e.g. another app or proxy) is listening on 3001, fix the URL or the process so that the DecentraGuild API receives the request.
