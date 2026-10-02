# Atomic protocol persistence and deposits

Implemented in the synchronized-pilot review branch; no live migration/deployment has been performed.

## What changed

- Protocol reads use one consistent database snapshot, including its revision.
- Saves send only changed/new rows. Routine commits do not delete any records.
- One PostgreSQL transaction locks the shared revision, rejects stale writers with `40001`, applies dependent rows in order, and increments the revision. Any failed insert/update rolls back the entire transaction.
- Ticks and judgments use the same save path. Read/tick requests retry revision conflicts up to three times. Artist POST requests return HTTP 409 on conflict so the client can refresh/retry without silently losing a judgment.
- Ledger, audit, and judgment records are append-only through this RPC. Unique indexes prevent a second prize/revenue credit per event and a second deciding assignment per battle.
- Wallet/reward changes must match new ledger entries in the same transaction. Wallet/reward balances cannot become negative.
- Stripe deposit processing locks the same revision and atomically stores the balance increment, ledger row, and receipt. Both event IDs and checkout-session IDs are deduplicated. A different Stripe event for an already-credited session cannot credit it again.
- Only signed, paid Artist Arcade USD sessions are credited; the verified session total controls the amount, not a metadata field. Unpaid completion waits for the asynchronous success event. Persistence failures return non-2xx so Stripe can retry.
- Checkout no longer writes balances or rewards. Existing Stripe customer IDs survive routine protocol saves.
- New database initialization starts wallets at zero. It does not convert the local demo seed's simulated $1 credits into USD. Existing balances are preserved and require reconciliation before launch.
- Public/persisted manual deposit, withdrawal, and reset actions are blocked. Local file persistence is demo-only; production requires Supabase.

## Migration and cutover

1. Use an isolated staging database and a staging Stripe account first.
2. Back up/reconcile existing accounts and ledger rows. The migration fails on historical duplicate event prizes/assignments or negative balances; it never deletes them automatically.
3. Apply schema prerequisites, `20261002_judgment_timeline.sql`, then `20261003_atomic_protocol.sql` in staging.
4. Deploy this branch to staging with staging Supabase/Stripe credentials. Verify a signed payment, repeated deliveries, a judgment/tick conflict, and a full tournament.
5. Production rollout must pause legacy protocol/payment writers, apply the migration, and deploy the new code as a coordinated change. Direct table writes are revoked from API roles; legacy code will fail after the migration. Do not apply the migration to the current live app on its own.

The SQL functions use a fixed table allowlist, a fixed search path, and service-role-only execute grants. Direct API-role mutation of protocol tables is revoked, so writes cannot bypass the revision lock. This does not implement user authentication: securing host/artist authority and private reads remains separate work.

Do not restore direct-write permissions as a workaround if the new RPC is unavailable. Surface the migration/configuration failure.

## Verification

`npm test` executes the real migration/functions in embedded PostgreSQL (PGlite), covering rollback, stale revisions, duplicate Stripe receipts, 64 queued deposits, 64 stale writers with explicit retries, customer-ID preservation, backed ledger changes, duplicate-prize rejection, and role permissions. It also runs the four-wave tournament tests.

PGlite serializes requests within one embedded database connection. These tests establish SQL behavior and stale-write rejection; they do not replace a staging load test with 64 independent clients/connections.

Type checking, targeted lint, and the production build pass locally. The live Supabase database and live Stripe webhook have not been tested with these migrations yet.

Primary references: [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html), [PostgreSQL JSON record functions](https://www.postgresql.org/docs/current/functions-json.html), [Stripe webhook retries and duplicates](https://docs.stripe.com/webhooks), [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).
