# Autonomous tournament worker

`vercel.json` schedules `/api/protocol/tick` once per minute. The endpoint verifies `Authorization: Bearer <CRON_SECRET>` and calls the shared database/engine code directly. It never fetches a deployment URL, needs no browser session, and returns no artist or outcome data. Missing secrets fail closed.

## Processing and recovery

- The worker loads a consistent database snapshot, locks full event queues, starts a ready 64-artist cohort, and processes elapsed wave deadlines and the shared reveal.
- Only changed state is committed. Revision conflicts reload the latest snapshot and retry up to three times. Database transactions prevent overlapping workers or artist requests from overwriting a newer commit.
- Repeated successful runs leave tournament state, assignments, prizes, and reveal records unchanged. Idle runs record a heartbeat but do not create tournament audit rows or increment the protocol revision.
- A delayed run uses the original timestamps and catches up all elapsed waves. It does not extend the 64-minute clock or reassign missed cards. The visible processing time can lag a deadline by the scheduling delay; this is not a guarantee of execution at an exact second.
- Processing failure returns an error and best-effort failure telemetry. Vercel does not retry failed cron deliveries automatically; the next minute's run reconciles persisted state. If the database is unavailable, even failure telemetry may be unavailable.
- `protocol_worker_health` stores the latest attempt, success, failure, and revision independently of tournament snapshots. Host readiness requires a success within two minutes and no equal/newer failed attempt. A secret alone does not mark automation ready. Worker-health values do not expose tournament outcomes to artists.
- Manual host reconciliation uses the authenticated host action. It does not create a worker heartbeat or make an inactive background schedule look healthy.

## Activation before rollout

The code and schedule are staged in draft PR #4. No live scheduler, secret, migration, billing plan, or production deployment has been changed.

1. Confirm the hosting plan supports once-per-minute cron jobs. Vercel Pro/Enterprise support this; Hobby's daily limit will reject this cron expression during deployment. The connected Artist Arcade project was confirmed on the Hobby plan on 2026-10-05. Its current plan cannot deploy this minute cron schedule. No upgrade has been purchased. An external minute scheduler can use the same protected endpoint if native Vercel scheduling is unsuitable; configure that provider separately and remove the native cron entry before deploying on Hobby.
2. Apply `20261005_worker_health.sql` after the three previous migrations on the intended staging database. Coordinate application/database cutover as described in `atomic-persistence.md`.
3. Set a strong server-only `CRON_SECRET` for the worker deployment. Vercel sends this value as the bearer token. Keep it out of the browser, logs, repository, and public environment variables.
4. Complete the authentication/email setup and database/payment checks. Then deploy the intended worker application. Native cron jobs run on production deployments, not preview deployments. For staging, explicitly invoke the protected endpoint or use a separate staging project with a compatible schedule; account for its deployment protection without exposing secrets.
5. Inspect worker logs and the host readiness check. Confirm successive successful runs, then close all artist tabs and rehearse a complete cohort.
6. Exercise overlapping calls, missed deadlines, a database outage, and duplicate runs. Confirm one final reveal and one prize ledger row per eligible event winner. Check provider logs for failed or missing deliveries; persistent heartbeat data does not send alerts automatically.

## Verification performed

Automated tests run the actual tick route and shared persistence/engine through embedded PostgreSQL. They verify secret rejection, conflict retries, concurrent runs, all four waves and four prizes without artist API reads, delayed catch-up without reassignment, repeat-run idempotency, failure/recovery, and restricted heartbeat permissions. Engine tests cover the random no-judgment path.

The tests simulate time and do not prove a deployed cron invocation, real Supabase network concurrency, a 64-client session, or email delivery. Deployment and staging rehearsal remain required.

Primary documentation: [Vercel cron usage and scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [cron delivery, failures, and concurrency](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
