# DecentraGuild

Web3 Infrastructure as a Service – one dapp, many tenants (dGuilds), with modular features (marketplace, raffles, whitelist, minting, etc.) on Solana.

## Repo layout

- **`apps/platform`** – Explore, onboarding, org creation (main domain).
- **`apps/tenant`** – dGuild portal; one app, all tenant subdomains (e.g. skull.decentraguild.com/market, /raffle).
- **`apps/api`** – Standalone backend API (Node.js/TypeScript) for multi-tenant off-chain services.
- **`packages/core`** – Tenant resolver and context (off-chain now, on-chain later).
- **`packages/ui`** – Shared Vue components.
- **`packages/web3`** – Wallet and Solana helpers.
- **`packages/contracts`** – Solana programs and IDLs.
- **`_integrate/`** – Reference only; do not edit. Finished pieces go here for integration.
- **`turbo.json`** – Turborepo pipeline (build, dev, lint).

Monorepo: **Turborepo** with pnpm workspaces.

## Running locally

From repo root:

- **`pnpm dev`** – Starts all apps (platform, tenant, api). Use different terminals if you only want one.
- **Platform (main domain):** [http://localhost:3000](http://localhost:3000) – Build Your Own, Discover dGuilds, Create org.
- **Tenant (dGuild portal):** [http://localhost:3002](http://localhost:3002) – Tenant is resolved by **subdomain** in production. On localhost there is no subdomain, so use the **query param**: [http://localhost:3002?tenant=skull](http://localhost:3002?tenant=skull) to load the Skull dGuild.
- **API:** [http://localhost:3001](http://localhost:3001) – `GET /` returns API info; `GET /api/v1/health` for health check.

If you open the tenant app without `?tenant=skull`, you get the tenant shell but no tenant context (no branding, no modules). That is expected.

## Backend and data

- **Backend:** Standalone Node.js API (TypeScript) in `apps/api`.
- **Database:** Postgres, hosted on Railway.
- **On-chain:** Solana programs + assets/holdings are the source of truth for trustless state.
- **Off-chain:** Backend + DB own tenant config distribution/caching, Discord ↔ wallet links, role rules, sync jobs, and audit logs.
- **Frontend:** Tenant app is a thin UI over wallets, Solana programs, and the backend API.
