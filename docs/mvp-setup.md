# Artist Arcade MVP Setup

This pilot now models the Artist Arcade battle protocol:

- 64 total MVP artists.
- 4 parallel events.
- 16 artists per event.
- Single-elimination bracket per event.
- 4 rounds per event: 16 -> 8 -> 4 -> 2 -> 1 winner.
- 15 battles per full event bracket, 60 total battles across the 4-event MVP.
- Artists pay one fifth of the desired prize to enter.
- Winner receives the desired prize.
- Remaining event pot becomes company revenue.
- Submissions must be 3 minutes or less.
- Artists have 24 hours to submit after a queue closes.
- Judges have a 15-minute timer after opening an assignment.
- Judges must come from outside the event they are judging.
- Judges cannot judge any battle involving their own submission.
- Scores use five weighted categories: Lyrics 25%, Delivery 20%, Originality 20%, Flow 15%, Impact 20%.

## Supabase

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
5. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.

The app uses server routes for database writes, so the service role key must stay server-side and must never be exposed in browser code.

The current `/arena` implementation runs this full protocol in local demo mode while the Supabase adapter is being completed against the new protocol schema. That lets the pilot flow be tested before live credentials are connected.

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
