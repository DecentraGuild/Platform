# Core package

Org/tenant resolver and tenant context. Used by both platform and tenant apps.

- **Tenant resolution:** From subdomain (e.g. skull.decentraguild.com) or later from on-chain config. For now, off-chain (e.g. JSON); later one platform contract with tenant id + config.
- **Tenant context:** Settings, branding, active modules, permissions. Injected so the tenant app and modules know which dGuild they are serving.
- **No UI** – logic and types only. Optional small SDK for “get current tenant”, “get tenant config”, “get user roles for this tenant”.
