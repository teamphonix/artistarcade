begin;
-- Protocol reads pass through the authenticated server projection, never PostgREST directly.
revoke all on public.protocol_artists, public.protocol_events, public.protocol_entries,
  public.protocol_submissions, public.protocol_battles, public.protocol_assignments,
  public.protocol_judgments, public.protocol_wallet_ledger, public.protocol_audit_log
  from public, anon, authenticated;
grant select on public.protocol_artists, public.protocol_events, public.protocol_entries to service_role;
commit;
