# Live Pilot Account Setup Order

Use this order so the Artist Arcade pilot can move from local demo mode to live participant testing without doubling back.

## 1. Vercel

Create this first so you have the production URL for webhooks, auth redirects, and email links.

What you need:

- Vercel account
- GitHub repo connected
- Project imported from `teamphonix/artistarcade`

You will get:

- Production app URL
- Environment variable dashboard
- Preview deployments

## 2. Supabase

Create this second because it is the live data layer.

What to do:

1. Create a new Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Save these values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

Later, you will also want:

- anon key for client auth
- storage bucket for uploads
- email auth settings

## 3. Stripe

Create the main Stripe platform account.

What to save:

- `STRIPE_SECRET_KEY`

What to configure:

- Test mode first
- Webhook endpoint later after Vercel URL is known

## 4. Stripe Connect

Enable Connect on the Stripe platform account if you want real participant payouts through the app.

This is the important upgrade beyond normal Stripe:

- basic Stripe = collect money
- Stripe Connect = onboard recipients and pay winners

## 5. Resend

Create this for notification email:

- sign-in or invite emails later
- event started
- submission deadline
- judging assignment ready
- winner reveal

What to save later:

- `RESEND_API_KEY`

## 6. Domain

Get a domain when you are ready for public pilot testing.

Needed for:

- branded production URL
- email sending domain
- trust with live users

## 7. Optional but smart

- Cloudflare for DNS/security
- Sentry for error tracking
- PostHog for analytics

## Environment Variables

Current app env file needs:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Next likely additions:

- `RESEND_API_KEY`
- `STRIPE_CONNECT_CLIENT_ID`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Best Next Move

Create these in this order:

1. Vercel
2. Supabase
3. Stripe
4. Stripe Connect
5. Resend

Once you have those accounts and keys, wire them into `.env.local` and Vercel project env vars, then switch the app from local demo mode toward live pilot mode.
