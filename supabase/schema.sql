create extension if not exists pgcrypto;

create table if not exists protocol_artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  stripe_customer_id text,
  wallet_cents integer not null default 0,
  reward_cents integer not null default 0,
  status text not null default 'registered'
    check (status in ('registered', 'queued', 'submitted', 'judging', 'advanced', 'eliminated', 'winner')),
  created_at timestamptz not null default now()
);

create table if not exists protocol_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null default 'rap',
  creator_artist_id uuid references protocol_artists(id),
  desired_prize_cents integer not null,
  entry_fee_cents integer not null,
  challenge_title text not null,
  challenge_description text not null,
  challenge_audio_url text not null,
  phase text not null default 'queue'
    check (phase in ('queue', 'submission', 'judging', 'complete')),
  current_round integer not null default 1,
  queue_opened_at timestamptz not null default now(),
  queue_closed_at timestamptz,
  submission_deadline timestamptz,
  judging_deadline timestamptz,
  winner_artist_id uuid references protocol_artists(id),
  company_revenue_cents integer not null default 0
);

create table if not exists protocol_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references protocol_events(id) on delete cascade,
  artist_id uuid not null references protocol_artists(id) on delete cascade,
  seed integer not null,
  paid_cents integer not null,
  status text not null default 'queued'
    check (status in ('queued', 'active', 'eliminated', 'winner')),
  joined_at timestamptz not null default now(),
  unique (event_id, seed),
  unique (artist_id)
);

create table if not exists protocol_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references protocol_events(id) on delete cascade,
  artist_id uuid not null references protocol_artists(id) on delete cascade,
  round integer not null,
  title text not null,
  audio_url text not null,
  duration_seconds integer not null check (duration_seconds between 1 and 180),
  submitted_at timestamptz not null default now(),
  unique (event_id, artist_id, round)
);

create table if not exists protocol_battles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references protocol_events(id) on delete cascade,
  round integer not null,
  slot integer not null,
  artist_a_id uuid not null references protocol_artists(id),
  artist_b_id uuid not null references protocol_artists(id),
  status text not null default 'pending'
    check (status in ('pending', 'judging', 'complete')),
  winner_artist_id uuid references protocol_artists(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (event_id, round, slot)
);

create table if not exists protocol_assignments (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references protocol_battles(id) on delete cascade,
  judge_artist_id uuid not null references protocol_artists(id) on delete cascade,
  status text not null default 'assigned'
    check (status in ('assigned', 'opened', 'completed', 'expired')),
  assigned_at timestamptz not null default now(),
  opened_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  unique (battle_id, judge_artist_id)
);

create table if not exists protocol_judgments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references protocol_assignments(id) on delete cascade,
  battle_id uuid not null references protocol_battles(id) on delete cascade,
  judge_artist_id uuid not null references protocol_artists(id) on delete cascade,
  lyrics integer not null check (lyrics between 1 and 10),
  delivery integer not null check (delivery between 1 and 10),
  originality integer not null check (originality between 1 and 10),
  flow integer not null check (flow between 1 and 10),
  impact integer not null check (impact between 1 and 10),
  selected_winner_artist_id uuid not null references protocol_artists(id),
  created_at timestamptz not null default now()
);

create table if not exists protocol_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references protocol_artists(id),
  event_id uuid references protocol_events(id),
  amount_cents integer not null,
  type text not null check (type in ('deposit', 'entry_fee', 'prize', 'company_revenue')),
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists protocol_entries_event_idx on protocol_entries(event_id);
create index if not exists protocol_submissions_event_round_idx on protocol_submissions(event_id, round);
create index if not exists protocol_battles_event_round_idx on protocol_battles(event_id, round);
create index if not exists protocol_assignments_battle_idx on protocol_assignments(battle_id);
create index if not exists protocol_assignments_judge_idx on protocol_assignments(judge_artist_id);
create index if not exists protocol_judgments_battle_idx on protocol_judgments(battle_id);
