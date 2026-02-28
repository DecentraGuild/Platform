# Config conventions

Id-first conventions for tenant and marketplace config.

---

## Tenant identity

| Field | Meaning |
|-------|---------|
| **id** | Permanent identifier. Used everywhere internally (billing, DB, APIs). |
| **slug** | Optional. Custom subdomain (e.g. `skull.decentraguild.com`). Can equal id. |

- Billing, DB, and internal APIs use **id**.
- Display and URLs use **slug** when present, else **id**.

---

## File naming

One file per tenant: `{id}.json`. Same for tenant and marketplace.

- `configs/tenants/{id}.json`
- `configs/marketplace/{id}.json`

Lookup accepts id or slug; files are keyed by id.

---

## JSON structure

### Tenant config

```json
{
  "id": "skull",
  "slug": "skull",
  "name": "Skull & Bones",
  "description": "...",
  "branding": { ... },
  "modules": { ... },
  "admins": [ ... ]
}
```

- **id** (required): permanent identifier
- **slug** (optional): custom subdomain; can equal id
- Other fields: see `TenantConfig` in `@decentraguild/core`

### Marketplace config

```json
{
  "tenantId": "skull",
  "tenantSlug": "skull",
  "collectionMints": [ ... ],
  "currencyMints": [ ... ],
  "splAssetMints": [ ... ],
  "whitelist": { ... },
  "shopFee": { ... }
}
```

- **tenantId** (required): tenant id for lookups
- **tenantSlug**: display; typically same as tenantId

---

## Database

Tables use `tenant_slug` as the column name. The value stored is **tenant.id**.

---

## Adding a tenant

1. Create `configs/tenants/{id}.json`
2. Optionally create `configs/marketplace/{id}.json` if marketplace is enabled
3. API seeds both on startup when DB is used
4. No code change
