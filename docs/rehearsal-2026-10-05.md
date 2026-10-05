# Rehearsal and rollout check — 2026-10-05

## Automated rehearsal completed

`npm test`: 36 passed, zero failed. The 64-artist engine simulation creates 60 battles and four event winners. The actual worker route, persistence RPCs, and all migrations run together against embedded PostgreSQL, process four waves without artist API reads, record one shared minute-64 reveal, and issue four eligible winner prize ledger rows. Repeated and overlapping worker calls do not duplicate settlements. Other scenarios verify missed judgments without reassignment, delayed catch-up, stale writes, duplicate deposit receipts, sealed responses, and database failure/recovery.

This uses simulated time, test identities, an embedded database, and stubbed payment/auth providers. It is not a live 64-client rehearsal, email delivery check, or real USD payment test.

## Production readiness check

The connected project is on Vercel Hobby, which cannot run the once-per-minute native schedule in this branch. Its project environment contains only NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY; the connector returned no hidden production variables. Stripe keys/webhook signing secret, CRON_SECRET, and verified host allowlist still need configuration. Sensitive Supabase variable values were not returned by the connector. No Supabase administration/SQL connection is available in this session; live migrations could not be inspected or applied. Email OTP provider/template delivery is unverified.

PR #5 deploys public wording separately with the existing production backend. PR #4 must not be promoted until the migration, identity, payments, and scheduling requirements are met.

## Live rehearsal sequence

1. Provide an isolated Supabase rehearsal database and test-mode Stripe configuration. Apply schema and all four dated migrations in order.
2. Configure email-code delivery, the verified host allowlist, and a worker secret. Use a hosting plan supporting minute jobs or a configured external minute scheduler.
3. Sign in 64 distinct test artists, confirm current rules consent, fund test wallets through signed provider webhooks, enter four events, and submit one original track each.
4. Close participant tabs to verify background progression. Observe one active cross-event card per assigned FateKeeper, votes sealed until deadlines, and original tracks advancing across four waves.
5. Deliberately miss an assigned duty; confirm expiry, no reassignment, fallback/forfeiture behavior, and loss of prize eligibility for the missed-duty judge.
6. After the shared reveal, verify event winners and backed prize ledger rows, no earlier outcome leakage, and idempotent repeat worker processing.
7. Reconcile existing production balances and coordinate legacy-writer shutdown, production migrations, deployment, and worker health before admitting paid artists.
