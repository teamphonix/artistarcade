# Artist identity and sealed results

This branch requires Supabase email verification before accessing the protocol API. There is no production/demo identity bypass. The separate mock event demonstrations still work without a paid artist account.

## Sign-in and authority

- `/` and `/artist` share the email-code form. Request a code, verify it, then create/update only the verified email's profile.
- Access and refresh tokens stay in HttpOnly, SameSite=Lax cookies; production also requires Secure. No token is returned to browser JavaScript or written to localStorage.
- Each protected API request verifies its access token with Supabase `auth.getUser`. User-supplied role metadata is ignored.
- `ARTIST_ARCADE_HOST_EMAILS` is a comma-separated server-only allowlist of verified host emails. An empty list grants nobody host privileges. Artists cannot perform host commands even when passing an arbitrary artist ID or role.
- Submission, entry, notification preference, and judgment actions check ownership against persisted state. Judges can lock only their own assigned card. Uploads require an owned profile and an open first-round submission window. Checkout uses the verified email instead of the body email.
- Browser mutations require an exact same-origin Origin header. API clients must supply this header too. Cross-origin requests cannot use the session to mutate state.
- Active artist/host pages refresh their session every ten minutes while open. Returning after session expiry requires sign-in again. Sign-out clears both cookies. Background-tab suspension, device sleep, and provider outages can interrupt refresh; staging must exercise a full 64-minute session.

## Artist payload

Artists receive their own account and ledger, their own entry/submission, and only the battle/audio needed for their active FateKeeper card. Other artists' email, balances, preferences, and ledger are excluded. Completed cards stop exposing their contenders until reveal. Own artist/entry elimination state is masked, judgments and winner fields are hidden, and future bracket identities and audit details are omitted before the shared reveal. Only the artist's own in-app notifications are returned.

After the engine records the final shared reveal, the artist's own battle results become accessible. Hosts retain the operational view. Responses use `Cache-Control: private, no-store`. The protected cron endpoint updates the database directly without an artist session. A minute schedule is staged but not activated; see `background-worker.md`.

Run `supabase/migrations/20261004_private_protocol.sql` after the earlier migrations in staging. It revokes direct protocol table access from public, anon, and authenticated roles so PostgREST cannot bypass the server projection. Service-role credentials must remain server-only. The migration has not been applied to a live database.

Uploaded audio currently uses a public storage bucket. This change protects tournament outcomes and account data; it does not promise private audio assets. Storage policy, upload abuse limits, and signed media delivery remain separate hardening work.

## Provider setup before rollout

1. Enable Supabase email authentication and confirmations.
2. Configure an email provider suitable for the participant cohort; validate delivery and provider rate limits in staging.
3. Change the passwordless email template to include `{{ .Token }}` so participants receive the code the form expects, rather than only the default magic link. Verify signup and returning-user code delivery.
4. Add the server-only host allowlist in staging and production. Test a host account and a regular artist account separately.
5. Apply all three migrations in staging with the coordinated application cutover described in `atomic-persistence.md`. Reconcile historical demo accounts and money before paid participants use the database.
6. Rehearse signup, expiry/refresh, logout, forged URLs/actions, upload ownership, all four waves, and final reveal with real Supabase sessions. Automated route tests use a mocked identity provider; they do not prove live email delivery or production session behavior.

Primary documentation: [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [refreshSession](https://supabase.com/docs/reference/javascript/auth-refreshsession).
