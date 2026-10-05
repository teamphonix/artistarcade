-- Apply after the judgment timeline migration, in staging first.
-- Coordinated cutover required: legacy code writes directly to these tables.
begin;

create table if not exists public.protocol_revision (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0
);
insert into public.protocol_revision(singleton) values(true) on conflict do nothing;

create table if not exists public.protocol_stripe_receipts (
  session_id text primary key,
  stripe_event_id text not null unique,
  artist_id uuid not null references public.protocol_artists(id),
  email text not null,
  amount_cents integer not null check (amount_cents > 0),
  ledger_id uuid not null unique references public.protocol_wallet_ledger(id),
  created_at timestamptz not null default now()
);

-- Fail rather than silently deleting historical duplicate prizes/cards.
create unique index if not exists protocol_one_prize_per_event
  on public.protocol_wallet_ledger(event_id) where type = 'prize' and event_id is not null;
create unique index if not exists protocol_one_revenue_per_event
  on public.protocol_wallet_ledger(event_id) where type = 'company_revenue' and event_id is not null;
create unique index if not exists protocol_one_assignment_per_battle
  on public.protocol_assignments(battle_id);

do $$ begin
  if not exists(select 1 from pg_constraint where conname='protocol_wallet_nonnegative' and conrelid='public.protocol_artists'::regclass) then
    alter table public.protocol_artists add constraint protocol_wallet_nonnegative check(wallet_cents >= 0);
  end if;
  if not exists(select 1 from pg_constraint where conname='protocol_rewards_nonnegative' and conrelid='public.protocol_artists'::regclass) then
    alter table public.protocol_artists add constraint protocol_rewards_nonnegative check(reward_cents >= 0);
  end if;
end $$;

create or replace function public.protocol_read_snapshot()
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_revision bigint;
  v_table text;
  v_rows jsonb;
  v_tables jsonb := '{}'::jsonb;
begin
  -- All writers lock this same row first. No reader can see half a commit.
  select revision into v_revision from public.protocol_revision where singleton for share;
  foreach v_table in array array['protocol_artists','protocol_events','protocol_entries','protocol_submissions','protocol_battles','protocol_assignments','protocol_judgments','protocol_wallet_ledger','protocol_audit_log'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by t.id), ''[]''::jsonb) from public.%I t', v_table) into v_rows;
    v_tables := v_tables || jsonb_build_object(v_table, v_rows);
  end loop;
  return jsonb_build_object('revision', v_revision, 'tables', v_tables);
end;
$$;

create or replace function public.protocol_commit(p_expected_revision bigint, p_patch jsonb)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_revision bigint;
  v_table text;
  v_rows jsonb;
  v_columns text;
  v_select text;
  v_updates text;
  v_key text;
  v_artist record;
  v_wallet_delta bigint;
  v_reward_delta bigint;
  v_allowed text[] := array['protocol_artists','protocol_events','protocol_entries','protocol_submissions','protocol_battles','protocol_assignments','protocol_judgments','protocol_wallet_ledger','protocol_audit_log'];
begin
  select revision into v_revision from public.protocol_revision where singleton for update;
  if p_expected_revision is null or v_revision <> p_expected_revision then
    raise exception 'Stale protocol revision' using errcode = '40001';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'Patch must be an object'; end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_allowed)) then raise exception 'Unknown protocol table'; end if;
  end loop;
  if p_patch = '{}'::jsonb then return v_revision; end if;
  -- Balance changes must be backed by new ledger rows in this SAME transaction.
  for v_artist in select * from jsonb_populate_recordset(null::public.protocol_artists,coalesce(p_patch->'protocol_artists','[]'::jsonb)) loop
    select coalesce(sum(r.amount_cents),0), coalesce(sum(r.amount_cents) filter(where r.type = 'prize'),0)
      into v_wallet_delta,v_reward_delta
      from jsonb_populate_recordset(null::public.protocol_wallet_ledger,coalesce(p_patch->'protocol_wallet_ledger','[]'::jsonb)) r
      where r.artist_id = v_artist.id and not exists(select 1 from public.protocol_wallet_ledger l where l.id = r.id);
    if v_artist.wallet_cents - coalesce((select wallet_cents from public.protocol_artists where id = v_artist.id),0) <> v_wallet_delta
       or v_artist.reward_cents - coalesce((select reward_cents from public.protocol_artists where id = v_artist.id),0) <> v_reward_delta then
      raise exception 'Balance change does not match new ledger entries' using errcode = '23514';
    end if;
  end loop;
  if exists(select 1 from jsonb_populate_recordset(null::public.protocol_wallet_ledger,coalesce(p_patch->'protocol_wallet_ledger','[]'::jsonb)) r
    where r.artist_id is not null and r.amount_cents <> 0
      and not exists(select 1 from public.protocol_wallet_ledger l where l.id = r.id)
      and not exists(select 1 from jsonb_populate_recordset(null::public.protocol_artists,coalesce(p_patch->'protocol_artists','[]'::jsonb)) a where a.id = r.artist_id)) then
    raise exception 'Ledger change requires matching artist balance update' using errcode = '23514';
  end if;
  foreach v_table in array v_allowed loop
    v_rows := p_patch -> v_table;
    if v_rows is null then continue; end if;
    if jsonb_typeof(v_rows) <> 'array' then raise exception 'Rows must be an array'; end if;
    if jsonb_array_length(v_rows) = 0 then continue; end if;
    if jsonb_array_length(v_rows) > 10000 then raise exception 'Too many patch rows'; end if;
    if not (v_rows->0 ? 'id') then raise exception 'Row ID is required'; end if;
    for v_key in select jsonb_object_keys(v_rows->0) loop
      if not exists (select 1 from pg_attribute where attrelid = format('public.%I',v_table)::regclass and attname = v_key and attnum > 0 and not attisdropped) then
        raise exception 'Unknown protocol column';
      end if;
    end loop;
    select string_agg(quote_ident(k), ',' order by k),
           string_agg('r.' || quote_ident(k), ',' order by k),
           string_agg(quote_ident(k) || '=excluded.' || quote_ident(k), ',' order by k) filter(where k <> 'id')
      into v_columns, v_select, v_updates from jsonb_object_keys(v_rows->0) k;
    -- Financial and audit records are append-only. Existing primary IDs cannot be rewritten.
    if v_table in ('protocol_wallet_ledger','protocol_audit_log','protocol_judgments') or v_updates is null then
      execute format('insert into public.%I(%s) select %s from jsonb_populate_recordset(null::public.%I,$1) r on conflict(id) do nothing', v_table,v_columns,v_select,v_table) using v_rows;
    else
      execute format('insert into public.%I(%s) select %s from jsonb_populate_recordset(null::public.%I,$1) r on conflict(id) do update set %s', v_table,v_columns,v_select,v_table,v_updates) using v_rows;
    end if;
  end loop;
  update public.protocol_revision set revision = revision + 1 where singleton returning revision into v_revision;
  return v_revision;
end;
$$;

create or replace function public.protocol_credit_stripe(
  p_stripe_event_id text, p_session_id text, p_email text, p_name text,
  p_amount_cents integer, p_customer_id text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_revision bigint;
  v_artist uuid;
  v_ledger uuid := gen_random_uuid();
  v_existing public.protocol_stripe_receipts;
  v_email text := lower(trim(p_email));
begin
  select revision into v_revision from public.protocol_revision where singleton for update;
  if p_amount_cents is null or p_amount_cents <= 0 or p_session_id is null or p_session_id = ''
     or p_stripe_event_id is null or p_stripe_event_id = '' or v_email is null or v_email = '' then
    raise exception 'Invalid verified Stripe credit';
  end if;
  select * into v_existing from public.protocol_stripe_receipts where session_id = p_session_id or stripe_event_id = p_stripe_event_id;
  if found then
    if v_existing.session_id <> p_session_id or v_existing.email <> v_email or v_existing.amount_cents <> p_amount_cents then
      raise exception 'Stripe receipt mismatch';
    end if;
    return jsonb_build_object('duplicate',true,'artistId',v_existing.artist_id,'revision',v_revision);
  end if;
  insert into public.protocol_artists(name,email,stripe_customer_id)
    values(coalesce(nullif(trim(p_name),''),'Artist'),v_email,p_customer_id)
    on conflict(email) do update set stripe_customer_id = coalesce(excluded.stripe_customer_id,protocol_artists.stripe_customer_id)
    returning id into v_artist;
  update public.protocol_artists set wallet_cents = wallet_cents + p_amount_cents where id = v_artist;
  insert into public.protocol_wallet_ledger(id,artist_id,event_id,amount_cents,type,note)
    values(v_ledger,v_artist,null,p_amount_cents,'deposit','Verified Stripe wallet deposit');
  insert into public.protocol_stripe_receipts(session_id,stripe_event_id,artist_id,email,amount_cents,ledger_id)
    values(p_session_id,p_stripe_event_id,v_artist,v_email,p_amount_cents,v_ledger);
  update public.protocol_revision set revision = revision + 1 where singleton returning revision into v_revision;
  return jsonb_build_object('duplicate',false,'artistId',v_artist,'revision',v_revision);
end;
$$;

revoke all on public.protocol_revision, public.protocol_stripe_receipts from public, anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.protocol_artists,public.protocol_events,public.protocol_entries,public.protocol_submissions,public.protocol_battles,public.protocol_assignments,public.protocol_judgments,public.protocol_wallet_ledger,public.protocol_audit_log from public, anon, authenticated, service_role;
revoke all on function public.protocol_read_snapshot(),public.protocol_commit(bigint,jsonb),public.protocol_credit_stripe(text,text,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.protocol_read_snapshot(),public.protocol_commit(bigint,jsonb),public.protocol_credit_stripe(text,text,text,text,integer,text) to service_role;
commit;
