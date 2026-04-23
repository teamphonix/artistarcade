create extension if not exists pgcrypto;

create table if not exists pilot_artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  stripe_customer_id text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'comped')),
  wallet_cents integer not null default 0,
  reward_cents integer not null default 0,
  status text not null default 'entered'
    check (status in ('entered', 'submitted', 'judging', 'advanced', 'eliminated', 'winner')),
  created_at timestamptz not null default now()
);

create table if not exists pilot_submissions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references pilot_artists(id) on delete cascade,
  title text not null,
  audio_url text not null,
  challenge text not null,
  created_at timestamptz not null default now(),
  unique (artist_id)
);

create table if not exists pilot_judging_assignments (
  id uuid primary key default gen_random_uuid(),
  judge_artist_id uuid not null references pilot_artists(id) on delete cascade,
  submission_id uuid not null references pilot_submissions(id) on delete cascade,
  round integer not null default 1,
  status text not null default 'assigned'
    check (status in ('assigned', 'completed')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (judge_artist_id, submission_id)
);

create table if not exists pilot_judgments (
  id uuid primary key default gen_random_uuid(),
  judge_artist_id uuid not null references pilot_artists(id) on delete cascade,
  submission_id uuid not null references pilot_submissions(id) on delete cascade,
  lyrics integer not null check (lyrics between 1 and 5),
  delivery integer not null check (delivery between 1 and 5),
  originality integer not null check (originality between 1 and 5),
  impact integer not null check (impact between 1 and 5),
  created_at timestamptz not null default now(),
  unique (judge_artist_id, submission_id)
);

create index if not exists pilot_submissions_artist_idx on pilot_submissions(artist_id);
create index if not exists pilot_assignments_judge_idx on pilot_judging_assignments(judge_artist_id);
create index if not exists pilot_assignments_submission_idx on pilot_judging_assignments(submission_id);
create index if not exists pilot_judgments_submission_idx on pilot_judgments(submission_id);
