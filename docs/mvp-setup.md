# Artist Arcade MVP Setup

This pilot supports 48 artists entering Pilot Ring A, submitting a performance link, receiving judging assignments, completing reviews, ranking results, and marking the winner reward.

## Supabase

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
5. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.

The app uses server routes for database writes, so the service role key must stay server-side and must never be exposed in browser code.

## Stripe

1. Create or open a Stripe account.
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint pointing to `/api/stripe/webhook`.
4. Subscribe the webhook to `checkout.session.completed`.
5. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

Stripe Checkout collects the $1 pilot entry. The webhook marks the artist as paid in Supabase after checkout completes.

## Local Development

Copy `.env.example` to `.env.local`, fill the values, then restart the dev server.

If Supabase is not configured, `/arena` runs in local demo mode using `data/pilot-state.json`. That lets the protocol be tested before the live services are connected.
