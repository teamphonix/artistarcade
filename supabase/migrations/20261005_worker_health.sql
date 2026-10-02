begin;
create table if not exists public.protocol_worker_health (
  singleton boolean primary key default true check (singleton),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_revision bigint
);
insert into public.protocol_worker_health(singleton) values(true) on conflict do nothing;
revoke all on public.protocol_worker_health from public, anon, authenticated, service_role;
grant select on public.protocol_worker_health to service_role;

create or replace function public.protocol_record_worker(p_started_at timestamptz, p_success boolean, p_revision bigint)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if p_started_at is null or p_success is null or p_started_at > now() + interval '1 minute' then
    raise exception 'Invalid worker receipt';
  end if;
  update public.protocol_worker_health set
    last_attempt_at = greatest(last_attempt_at, p_started_at),
    last_success_at = case when p_success then greatest(last_success_at, p_started_at) else last_success_at end,
    last_failure_at = case when not p_success then greatest(last_failure_at, p_started_at) else last_failure_at end,
    last_revision = case when p_success then greatest(last_revision, p_revision) else last_revision end
  where singleton;
end;
$$;
revoke execute on function public.protocol_record_worker(timestamptz,boolean,bigint) from public, anon, authenticated;
grant execute on function public.protocol_record_worker(timestamptz,boolean,bigint) to service_role;
commit;
