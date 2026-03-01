---
title: Verify flow
description: How members link wallet to Discord
---

# Verify flow

## What it does

Verify links a member’s wallet to their Discord account. Once linked, role rules assign or revoke roles based on on-chain holdings.

## How members verify

1. Member runs `/verify` in your Discord server
2. The bot sends a private message with a link
3. Member opens the link on your dGuild’s site, connects wallet, signs
4. The platform records the wallet–Discord link

The link includes a token that ties the request to their Discord account. It opens the verify page on your dGuild’s domain (e.g. `skull.dguild.org/verify?token=...`). Without a token, they see a message to use the link from Discord.
