# Artist Arcade MVP Setup

> Product behavior and terminology are governed by [`PRODUCT-BIBLE.md`](PRODUCT-BIBLE.md). This file documents the current technical pilot configuration.

## Season Zero Structure

The pilot models the Artist Arcade battle protocol with four simultaneous event pools so artists competing in one event can serve as eligible FateKeepers for the other event pools.

- **64 total MVP artists.**
- **4 parallel events.**
- **16 artists per event.**
- Each artist competes in one event and is eligible for judging assignments from the other three event pools.
- Single-elimination bracket per event.
- 4 rounds per event: 16 -> 8 -> 4 -> 2 -> 1 winner.
- 15 battles per full event bracket, 60 total battles across the 4-event MVP.
- For the pilot, each artist pays $1 to enter.
- For the pilot, the winner receives $5.
- The remaining event pot becomes company revenue before payment/operating costs.
- Submissions must be 3 minutes or less.
- Artists have 24 hours to submit after a queue closes.
- FateKeepers have a 15-minute timer after opening an assignment.
- FateKeepers must come from outside the event they are judging.
- FateKeepers cannot judge any battle involving their own submission.
- Current implementation uses one FateKeeper per battle.

## Mandatory Judging

Judging is a condition of participation, not an optional side activity.

- Artists must complete required FateKeeper assignments within the allotted time.
- Failure to complete a required judgment can automatically eliminate the non-compliant artist from their own active competition path.
- Expired assignments must never deadlock the tournament; the protocol uses its timeout/fallback resolution so the affected battle/event can continue.
- Timeout and elimination actions should be recorded in the protocol audit trail.

See the Product Bible for the full blind-progression, battle-perspective, training, rank, and future experience rules.

## Current Scoring Rubric

The implemented MVP scoring categories are:

- Lyrics: 25%
- Delivery: 20%
- Originality: 20%
- Flow: 15%
- Impact: 20%

Future challenge-specific rubrics require explicit product approval and testing.

## Supabase

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
5. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.
6. Optional: set `SUPABASE_SUBMISSIONS_BUCKET=submissions` if you want a custom bucket name.

The app uses server routes for database writes, so the service role key must stay server-side and must never be exposed in browser code.

The `/arena` protocol route uses Supabase in production when the env vars are present and falls back to local demo state only when Supabase is not configured. Submission uploads use a Supabase Storage bucket named `submissions` by default and will auto-create it when the upload route runs with a service role key.

## Stripe

1. Create or open a Stripe account.
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint pointing to `/api/stripe/webhook`.
4. Subscribe the webhook to `checkout.session.completed`.
5. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

Stripe Checkout is installed and ready to support wallet deposits or event entry checkout. The current demo uses the local wallet ledger so the protocol can be tested without live payments.

## Local Development

Copy `.env.example` to `.env.local`, fill the values, then restart the dev server.

If Supabase is not configured, `/arena` runs in local demo mode using `data/pilot-state.json`. That lets the protocol be tested before the live services are connected.
