---
title: Discord
description: Wallet linking and role assignment
---

# Discord

The Discord module links your community’s wallets to their Discord identities. Roles are assigned or revoked based on on-chain holdings (NFTs, tokens).

## Chapters

- [Verify flow](/docs/modules/discord/verify-flow) — How members link their wallet
- [Setup and role rules](/docs/modules/discord/setup) — Bot invite, mint catalog, role rules

## Overview

Members run `/verify` in your Discord server to get a link. They open it, connect their wallet, and sign. The platform records the link. You configure role rules in Admin with conditions such as "holds NFT from collection X" or "has SPL balance of Y". A sync job keeps roles up to date.
