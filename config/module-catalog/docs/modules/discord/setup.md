---
title: Setup and role rules
description: Bot invite, mint catalog, role rules
---

# Setup and role rules

## Server setup

1. Invite the DecentraGuild bot to your Discord server using the invite URL from Admin > Discord.
2. Link the server in Admin: enter your Discord server ID and confirm.
3. Ensure the bot has a role high enough to assign the roles you want. It can only assign roles below its own.

## Mint catalog

The mint catalog defines which NFTs and SPL tokens can be used in role rules. Add mints in Admin > Discord. Each mint counts toward your tier limit. Only mints in the catalog can be used in conditions.

## Role rules

Each rule assigns one Discord role when its conditions are met. Max 5 conditions per rule, combined with AND or OR. Condition types:

- **SPL balance** — Member holds at least X of token Y
- **NFT** — Member holds at least one NFT from collection X
- **Trait** — Member holds an NFT with a specific trait
- **Discord role** — Member has a Discord role (useful for AND/OR with on-chain conditions)

Sync runs on a schedule and when links or config change. Expect a short delay between on-chain change and role update.
