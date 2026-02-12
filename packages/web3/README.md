# Web3 package

Wallet and Solana contract helpers. Shared by platform and tenant apps and by modules.

- Wallet connection (e.g. Phantom, Solflare).
- RPC and data verification (e.g. Helius for read-only RPC and data).
- Account reading, transaction building in the client; no server-side transaction posting.
- Wrappers or helpers for program calls; actual program IDs and IDLs can live in `packages/contracts` or here depending on how we split it.

Solana only. Full self-custody; no custodial backend. Helius (or other RPC) is used for RPC calls and data verification only, not for posting transactions.
