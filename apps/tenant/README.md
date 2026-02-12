# Tenant app (dGuild portal)

The single app that serves **all** dGuild subdomains (e.g. skull.decentraguild.com). Tenant is resolved from the subdomain (or later from on-chain config).

- **layouts/** – Shell layout per tenant (branding, nav).
- **router/** – Routes; tenant context from subdomain.
- **modules/** – Feature modules (marketplace, raffles, minting, whitelist, etc.); each can be enabled or disabled per dGuild.
- **pages/** – Top-level tenant pages (Home, Admin, etc.).

One deploy; tenant identity comes from the host. Built with Vue. Shares `packages/core`, `packages/ui`, `packages/web3`.
