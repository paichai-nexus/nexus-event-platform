create extension if not exists pgcrypto;

create type public.app_role as enum ('ADMIN', 'STAFF', 'JUDGE');
create type public.event_mode as enum ('REHEARSAL', 'LIVE');
create type public.event_status as enum (
  'SETUP', 'CHECK_IN_OPEN', 'VOTING_READY', 'VOTING_OPEN', 'VOTING_CLOSED',
  'JUDGING', 'SCORING', 'FINALIZED', 'ENDED'
);
create type public.voting_status as enum ('READY', 'OPEN', 'CLOSED');
create type public.team_category as enum ('STARTUP', 'BUSINESS_ANALYSIS');
create type public.team_status as enum ('WAITING', 'PRESENTING', 'DONE');
create type public.evaluation_scope as enum ('AUDIENCE', 'JUDGE');
create type public.submission_status as enum ('DRAFT', 'SUBMITTED');
create type public.check_in_source as enum ('QR', 'MANUAL', 'IMPORT');
create type public.prize_draw_status as enum ('ACTIVE', 'CANCELLED', 'REDRAWN');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text not null,
  mode public.event_mode not null default 'REHEARSAL',
  status public.event_status not null default 'SETUP',
  voting_status public.voting_status not null default 'READY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_code text not null,
  display_label text not null,
  affiliation text,
  access_token_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, participant_code),
  unique (event_id, access_token_hash)
);

comment on column public.participants.access_token_hash is
  'TEMPORARY / RULE_NOT_CONFIRMED: participant access adapter credential hash. Never store the plaintext token.';

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  category public.team_category not null,
  presentation_order integer not null check (presentation_order > 0),
  status public.team_status not null default 'WAITING',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name),
  unique (event_id, presentation_order)
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete restrict,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users(id) on delete set null,
  source public.check_in_source not null,
  created_at timestamptz not null default now(),
  unique (event_id, participant_id)
);

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  scope public.evaluation_scope not null,
  name text not null,
  description text,
  max_score numeric(8, 2) not null check (max_score > 0),
  weight numeric(8, 5) not null default 1 check (weight > 0),
  order_index integer not null check (order_index >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, scope, order_index)
);

create table public.audience_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, participant_id, team_id)
);

create table public.audience_scores (
  submission_id uuid not null references public.audience_submissions(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete restrict,
  score numeric(8, 2) not null check (score >= 0),
  primary key (submission_id, criterion_id)
);

create table public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  judge_user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, judge_user_id, team_id)
);

create table public.judge_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  judge_user_id uuid not null references auth.users(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  status public.submission_status not null default 'DRAFT',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, judge_user_id, team_id),
  constraint judge_submission_time check (
    (status = 'DRAFT' and submitted_at is null) or
    (status = 'SUBMITTED' and submitted_at is not null)
  )
);

create table public.judge_scores (
  submission_id uuid not null references public.judge_submissions(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete restrict,
  score numeric(8, 2) not null check (score >= 0),
  primary key (submission_id, criterion_id)
);

create table public.result_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  finalized_by uuid not null references auth.users(id) on delete restrict,
  finalized_at timestamptz not null default now(),
  score_rule_version text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table public.prize_draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  round integer not null check (round > 0),
  participant_id uuid not null references public.participants(id) on delete restrict,
  drawn_by uuid not null references auth.users(id) on delete restrict,
  drawn_at timestamptz not null default now(),
  status public.prize_draw_status not null default 'ACTIVE',
  note text,
  created_at timestamptz not null default now(),
  unique (event_id, round)
);

create unique index prize_draws_one_active_win_per_participant
  on public.prize_draws (event_id, participant_id)
  where status = 'ACTIVE';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger participants_set_updated_at before update on public.participants
for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
for each row execute function public.set_updated_at();
create trigger criteria_set_updated_at before update on public.evaluation_criteria
for each row execute function public.set_updated_at();
create trigger judge_submissions_set_updated_at before update on public.judge_submissions
for each row execute function public.set_updated_at();
