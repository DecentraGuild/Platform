# Escrow exchange: reference implementations vs current (DecentraGuild)

This document compares how the two working references build and send the exchange (fill) transaction with how we do it. It does not fix anything; it only highlights differences and where we diverged.

---

## 1. References

| Reference | Location | Stack |
|-----------|----------|--------|
| **C2C** | `_integrate/C2C/` | Vue, solana-wallets-vue, Anchor, builder in `utils/escrowTransactions.js`, caller in `composables/useEscrowTransactions.js` |
| **Skullnbones (dev example)** | `_integrate/C2C/Example/escrow.skullnbones.xyz_3-master/` | Quasar/Vue, solana-wallets-vue, Anchor, logic in `ExchangeEscrowAction.vue` + `adapter/escrow_gen/instructions/exchange.ts` |

---

## 2. Who sets blockhash and fee payer

| | C2C | Skullnbones | Ours (DecentraGuild) |
|---|-----|-------------|----------------------|
| **Where** | **Caller** (`useEscrowTransactions.sendAndConfirm`): after `buildExchangeTransaction()` returns, it sets `transaction.recentBlockhash`, `transaction.feePayer`, then calls `walletAdapter.sendTransaction(transaction, connection)`. | **Not set in app code.** They call `sendTransaction(transaction, connection)`. The wallet adapter (solana-wallets-vue) is responsible for adding blockhash/feePayer when sending. | **Inside the builder** (init, cancel, exchange): we set `transaction.recentBlockhash`, `transaction.feePayer`, and `lastValidBlockHeight` at the **end** of each build, after adding instructions. |
| **When** | After build, before send. | Implicit in adapter. | At the end of each builder, before the transaction is returned. |

**Difference:** The references either set blockhash/feePayer in the **caller** or leave it to the **adapter**. We set them **inside the builder** so that the transaction is “complete” before it leaves the builder. That was a deliberate change to fix “Failed to sign transaction” when using the headless connector (no adapter `sendTransaction`). So the **decision to set them in the builder** was ours, to match the “sign only then sendRawTransaction” flow.

---

## 3. Send path (how the transaction reaches the wallet and network)

| | C2C | Skullnbones | Ours |
|---|-----|-------------|------|
| **Flow** | Build tx → caller sets blockhash/feePayer → **`walletAdapter.sendTransaction(transaction, connection)`**. One call: adapter handles serialize, send to wallet, get signature, submit. | Build tx → **`sendTransaction(transaction, connection)`**. Same: adapter does everything. | Build tx (with blockhash/feePayer already set) → **`wallet.signTransaction(tx)`** (headless connector) → we **`connection.simulateTransaction(signed)`** → we **`connection.sendRawTransaction(signed.serialize())`** → we **`connection.confirmTransaction(sig)`**. |
| **Wallet sees** | Adapter sends the transaction; wallet typically sees a “sign and send” style flow (adapter may set blockhash before sending to wallet). | Same. | Wallet is only asked to **sign**; we do simulate and send ourselves. So wallet never does “send”; we do. |

**Difference:** The references use the wallet **adapter’s `sendTransaction`**. We do **not** use `sendTransaction`; we use the headless connector’s **`signTransaction`** and then we simulate and **`sendRawTransaction`** ourselves. So the way the transaction is serialized and handed to the wallet (and how the wallet might mutate or re-serialize it) can differ. Any “invalid” or “invalid argument” could be tied to this path (e.g. connector or wallet expecting the same shape as when the adapter sends).

---

## 4. Optional accounts (no whitelist)

When the escrow has **no whitelist**, what is passed for `whitelistProgram`, `whitelist`, `entry`?

| | C2C | Skullnbones | Ours |
|---|-----|-------------|------|
| **whitelistProgram** | `toPublicKey(WHITELIST_PROGRAM_ID)` when null (i.e. always a real program ID, not escrow). | **`null`** | **`program.programId`** (escrow program ID). |
| **whitelist** | **`null`** | **`null`** | **`program.programId`** |
| **entry** | **`null`** | **`null`** | **`program.programId`** |

**Difference:** The two references pass **`null`** for whitelist/entry when not used, and C2C uses **WHITELIST_PROGRAM_ID** for the program when there’s no whitelist. We switched to **escrow `program.programId`** for all three optional accounts based on Anchor’s “pass program ID for unused optional accounts” advice. So **we** decided to differ from the references here; the references were not updated to that pattern and they work with `null` / WHITELIST_PROGRAM_ID.

---

## 5. ATA creation (taker token accounts)

| | C2C | Skullnbones | Ours |
|---|-----|-------------|------|
| **Request token ATA for taker** (pay-from) | Created **if missing** (first in order). | Created **if missing** (second in order: after deposit ATA). | **Not created.** We assume taker already has it if they can fill. |
| **Deposit token ATA for taker** (receive-into) | Created **if missing** (second in order). | Created **if missing** (first in order). | Created **if missing** (only ATA we add). |
| **Order of instructions** | (1) Create request ATA if needed, (2) Create deposit ATA if needed, (3) exchange. | (1) Create deposit ATA if needed, (2) Create request ATA if needed, (3) exchange. | (1) Create deposit ATA if needed, (2) exchange. |

**Difference:** We **removed** adding the “create request token ATA” instruction on the basis that the taker must already have that account (and balance) to fill. The references **do** add it when missing. So we have fewer instructions and a different instruction order than both references.

---

## 6. Exchange instruction and account mapping

- **C2C** and **Skullnbones** use the same IDL account order: maker, makerReceiveAta, depositToken, taker, **takerAta**, **takerReceiveAta**, requestToken, auth, vault, escrow, token program, associated token program, system program, fee, whitelistProgram, whitelist, entry.
- **Semantics:**  
  - `takerAta` = taker’s account that holds **request** token (debited = “pay from”).  
  - `takerReceiveAta` = taker’s account that holds **deposit** token (credited = “receive into”).
- **Our `getExchangeATAs`** matches this: `takerAta` = request token ATA for taker, `takerReceiveAta` = deposit token ATA for taker. So we did **not** change account semantics; we only changed ATA creation (we don’t create request ATA) and optional-account values.

---

## 7. Instruction source (exchange ix)

| | C2C | Skullnbones | Ours |
|---|-----|-------------|------|
| **How** | `program.methods.exchange(amountBN).accounts(accounts).instruction()` then `transaction.add(exchangeIx)`. | `pg_escrow?.value.methods.exchange(...).accounts({...}).**transaction()**` then `transaction.add(await escrow_transaction)`. So they add a **whole Transaction** (one instruction) to their outer transaction. | Same as C2C: `program.methods.exchange(amountBN).accounts(accounts).instruction()` then `transaction.add(exchangeIx)`. |

So C2C and we use **`.instruction()`**; Skullnbones uses **`.transaction()`** and merges. Functionally the resulting instruction should be the same; only the way it’s built differs.

---

## 8. Summary: who decided what

| Difference | Reference behaviour | Our behaviour | Who decided |
|------------|---------------------|---------------|-------------|
| Blockhash / fee payer | Set in **caller** (C2C) or by **adapter** (Skullnbones). | Set **inside builder** at start. | Us (to work with headless connector sign-only flow). |
| Send path | `sendTransaction(transaction, connection)`. | `signTransaction(tx)` then we simulate and `sendRawTransaction`. | Us (we use headless connector, no adapter sendTransaction). |
| Optional accounts (no whitelist) | **null** or **WHITELIST_PROGRAM_ID**. | **program.programId** (escrow) for all three. | Us (from Anchor “optional = program ID” guidance). |
| Create request-token ATA for taker | Both references **create it if missing**. | We **do not create it**. | Us (assumption: taker already has it to fill). |
| Create deposit-token ATA for taker | Both **create if missing**. | We **create if missing**. | Same as references. |
| ATA instruction order | C2C: request then deposit. Skullnbones: deposit then request. | We only have deposit (if needed) then exchange. | Us (fewer instructions). |

So the structural differences (where blockhash is set, how we send, optional accounts, and which ATAs we create) are **our** choices, not taken from the two working examples. Aligning with the references would mean: same optional-account values as in C2C/Skullnbones, same ATA-creation policy and order as in at least one reference, and (if possible) same send path or at least same transaction shape the wallet sees.

---

## 9. Files to compare line-by-line

- **C2C:**  
  - `_integrate/C2C/src/utils/escrowTransactions.js` (buildExchangeTransaction)  
  - `_integrate/C2C/src/composables/useEscrowTransactions.js` (sendAndConfirm, exchangeEscrow)  
  - `_integrate/C2C/src/utils/transactionBuilders.js` (getExchangeATAs, prepareTakerATAs)
- **Skullnbones:**  
  - `_integrate/C2C/Example/escrow.skullnbones.xyz_3-master/src/components/actions/ExchangeEscrowAction.vue`  
  - `_integrate/C2C/Example/escrow.skullnbones.xyz_3-master/src/adapter/escrow_gen/instructions/exchange.ts`
- **Ours:**  
  - `packages/web3/src/escrow/build.ts` (buildExchangeTransaction)  
  - `packages/web3/src/escrow/transaction-builders.ts` (getExchangeATAs, prepareTakerATAs)  
  - `packages/web3/src/escrow/send.ts` (sendAndConfirmTransaction)  
  - `apps/tenant/src/modules/marketplace/components/EscrowDetailModal.vue` (handleFill uses sendAndConfirmTransaction)

---

## 10. Current implementation (what we ship)

- **Blockhash / fee payer:** Set **inside all three builders** (init, cancel, exchange) at the end of each build via `setTransactionBlockhashAndFeePayer(connection, transaction, feePayer)`. The transaction is fully formed before it leaves the builder, so the wallet and RPC see a valid shape. `sendAndConfirmTransaction` also sets blockhash/feePayer again before sign (fresh blockhash).
- **Send path:** `sendAndConfirmTransaction` in `packages/web3/src/escrow/send.ts`: sign with wallet, simulate, send via `sendRawTransaction`, confirm. Create, cancel, and fill all use this helper.
- **Optional accounts (no whitelist):** Exchange uses escrow **program.programId** for all three (`whitelistProgram`, `whitelist`, `entry`) when there is no whitelist (Anchor convention for unused optionals).
- **Fill “no whitelist” detection:** In the tenant app, when reading the escrow we treat both `SystemProgram.programId` and **escrow program ID** as “no whitelist”, so we pass `whitelist: null` into the builder for escrows created without a whitelist.
- **ATA creation:** Both request and deposit ATAs for taker are created **only when missing** (C2C order: request first, then deposit).

---

## 11. What fixed fill (lessons learned)

1. **Blockhash/feePayer in the builder**  
   Moving blockhash/feePayer into the caller only broke simulation for create, cancel, and fill. Setting them **inside** each builder again (so the transaction is complete before sign) fixed simulation for all three.

2. **simulateTransaction API (Legacy vs Versioned)**  
   `@solana/web3.js` has two overloads: for a **VersionedTransaction** the second argument is a config object (e.g. `{ sigVerify: false }`); for a **Legacy Transaction** the second argument must be an array of signers or `undefined`, not a config object. We were always passing `{ sigVerify: false }`, so for a signed Legacy transaction the library threw **"Invalid arguments"**. Fix: only pass the config when the signed value has a `message` property (VersionedTransaction); otherwise call `simulateTransaction(signed)` with one argument.

3. **Optional whitelist accounts**  
   For escrows with no whitelist we pass the escrow program ID for the three optional accounts; in the modal we treat the escrow’s stored “no whitelist” value (escrow program ID) so we do not pass it as a real whitelist.
