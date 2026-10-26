-- Prepared for review; do not apply to the operating database without approval.
create type public.mission_type as enum ('DEPARTMENT_INTRO', 'TEAM_SUPPORT', 'BUSINESS_QUIZ', 'OX_QUIZ', 'APPLAUSE_EXPERIMENT');
create type public.mission_status as enum ('DRAFT', 'ACTIVE', 'CLOSED');
create type public.mission_participation_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create table public.cheer_missions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text not null default '',
  mission_type public.mission_type not null,
  points integer not null check (points between 0 and 10000),
  status public.mission_status not null default 'DRAFT',
  experimental boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applause_is_experimental check (mission_type <> 'APPLAUSE_EXPERIMENT' or experimental = true)
);

create table public.mission_participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  mission_id uuid not null references public.cheer_missions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete restrict,
  status public.mission_participation_status not null default 'PENDING',
  awarded_points integer not null default 0 check (awarded_points >= 0),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mission_id, participant_id)
);

create trigger cheer_missions_set_updated_at before update on public.cheer_missions
for each row execute function public.set_updated_at();
alter table public.cheer_missions enable row level security;
alter table public.mission_participations enable row level security;
create policy cheer_missions_staff_manage on public.cheer_missions for all to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF')) with check (public.current_app_role() in ('ADMIN', 'STAFF'));
create policy mission_participations_staff_manage on public.mission_participations for all to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF')) with check (public.current_app_role() in ('ADMIN', 'STAFF'));

comment on table public.cheer_missions is 'Cheer points are independent from official judge and audience scores.';
