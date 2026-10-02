# Artist Arcade: synchronized 64-player pilot

## Locked tournament rules

- Four simultaneous events, sixteen distinct artists in each, one entry per artist.
- Each artist uploads one track. That same submission is used in every round.
- Four synchronized waves: 15 minutes of judging followed by 1 minute of resolution/transition. First-card availability starts the 64-minute clock.
- One deciding FateKeeper per battle. Assignments are random, outside the judge's own event, and limited to one active card per artist.
- Assignment counts vary. No assignment means no obligation and no penalty.
- Advancing tracks cannot encounter the same FateKeeper again in a later round.
- Eliminated artists remain in the duty pool; no personal result is revealed before the shared final reveal.
- Early locks are sealed. They do not advance the next wave early.
- A card without a valid judgment at its deadline receives a cryptographically random 50/50 advancement. It is never reassigned, and the audit labels the fallback.
- An expired duty disqualifies the assigned artist from winning. When exactly one contender is eligible, duty forfeiture overrides the track score. If both contenders are ineligible, a track can continue for bracket continuity, but it cannot receive a winner prize. An event with no eligible final winner is recorded for host resolution; the engine does not invent a refund policy.
- Final reveal and internal USD prize credits occur at minute 64. Internal ledger credits are not bank payouts.

## Engine and validation

`src/app/lib/tournament.ts` advances a persisted snapshot using fixed timestamps. Audit records store cohort start, wave distribution, deadline resolution, fallback provenance, and reveal. Repeat ticks are idempotent within a serialized snapshot. A delayed worker catches up using original deadlines rather than extending the tournament.

The protocol route now records a sealed judgment and calls the engine for progression. It no longer opens a new upload window per round. Independent A/B score values are stored correctly. Build type checking is restored.

The event room refreshes assignments without overlapping polling requests and shows the shared reveal countdown. The results page stays sealed while the cohort is running. These UI controls are not a substitute for server-side confidentiality.

Run `npm test`, `npx tsc --noEmit`, and `npm run build`.

Before using the changed route against Supabase, apply `supabase/migrations/20261002_judgment_timeline.sql` to the intended test database. No migration has been applied automatically.

## Production blockers — do not merge/deploy for real USD yet

1. **Atomic persistence rollout:** revision-checked transactions, incremental row patches, and atomic Stripe deposit receipts are implemented on this branch. The migrations have not been applied to staging/production. Validate coordinated cutover and reconcile any historical demo balances or duplicate prizes before real USD use. See `docs/atomic-persistence.md`.
2. **Identity and authority:** authenticate artists and hosts; verify ownership of every submission and assigned card; protect reset and balance mutations.
3. **Server-side sealed views:** the existing public protocol payload exposes bracket information and private artist state. Serve authenticated, limited artist views and a protected host view. The results-page guard alone cannot hide outcomes from network inspection.
4. **Background processing:** `vercel.json` currently has no cron jobs. Provision a protected worker that ticks at least once each minute without requiring an artist's browser to remain open. A `CRON_SECRET` alone does not schedule a worker. The tick endpoint now denies requests when its secret is absent.
5. **Money:** duplicate-safe deposits and checkout balance preservation are implemented and tested locally. Run signed Stripe sandbox deliveries against staging, then implement verified bank payouts, refunds, and dispute handling. Manual persisted balance mutations/withdrawals are disabled; the previous withdrawal route did not transfer funds to a bank.
6. **Notification delivery:** in-app assignment refreshes work while a page is open. Email/push delivery, retries, and provider setup remain unimplemented.
7. **Full staging rehearsal:** exercise the authenticated API and transaction layer with 64 concurrent clients, deadline races, reloads, network interruptions, and duplicate payment events before inviting paid users.

This branch is a tested tournament-engine implementation, not a declaration that production is ready for paid competition. The existing live mock events remain separate simulations.
