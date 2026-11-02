-- Persistent, event-scoped audience jury authentication and ranked ballots.
-- Official score conversion remains intentionally out of scope.

alter table public.teams
  add constraint teams_event_id_id_category_key unique (event_id, id, category);

create table public.audience_rank_ballots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reservation_id uuid not null references public.audience_jury_reservations(id) on delete restrict,
  category public.team_category not null,
  first_team_id uuid not null,
  second_team_id uuid not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, reservation_id, category),
  constraint audience_rank_distinct_teams check (first_team_id <> second_team_id),
  constraint audience_rank_first_team_fk foreign key (event_id, first_team_id, category)
    references public.teams(event_id, id, category) on delete restrict,
  constraint audience_rank_second_team_fk foreign key (event_id, second_team_id, category)
    references public.teams(event_id, id, category) on delete restrict
);

create index audience_rank_ballots_event_category_idx
  on public.audience_rank_ballots (event_id, category, submitted_at);

alter table public.audience_rank_ballots enable row level security;

create policy audience_rank_ballots_staff_read on public.audience_rank_ballots
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

revoke all on public.audience_rank_ballots from anon, authenticated;
grant select on public.audience_rank_ballots to authenticated;

create function public.authenticate_audience_jury(
  p_event_id uuid,
  p_name text,
  p_student_number text,
  p_pcu_code text,
  p_auth_token text
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event_id uuid;
  selected_reservation public.audience_jury_reservations%rowtype;
begin
  if length(coalesce(p_auth_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into selected_reservation
  from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event_id
    and reservation.attendee_name = trim(p_name)
    and reservation.student_number = upper(trim(p_student_number))
    and reservation.pcu_code = upper(trim(p_pcu_code))
    and reservation.qr_checked_in_at is not null
  for update;
  if selected_reservation.id is null then raise exception 'AUDIENCE_JURY_AUTH_FAILED'; end if;

  update public.audience_jury_reservations
  set session_token_hash = encode(digest(p_auth_token, 'sha256'), 'hex')
  where id = selected_reservation.id;

  return jsonb_build_object(
    'department', selected_reservation.department,
    'name', selected_reservation.attendee_name,
    'studentNumber', selected_reservation.student_number,
    'serialNumber', selected_reservation.pcu_code,
    'acceptedAt', selected_reservation.qr_checked_in_at
  );
end;
$$;

create function public.get_audience_rank_ballot_state(p_event_id uuid, p_auth_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  selected_reservation public.audience_jury_reservations%rowtype;
  selected_open_category public.team_category;
begin
  if length(coalesce(p_auth_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;
  select * into selected_event
  from public.events
  where id = public.resolve_attendance_event(p_event_id);
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into selected_reservation
  from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event.id
    and reservation.session_token_hash = encode(digest(p_auth_token, 'sha256'), 'hex')
    and reservation.pcu_code is not null
    and reservation.qr_checked_in_at is not null;
  if selected_reservation.id is null then raise exception 'AUDIENCE_JURY_AUTH_REQUIRED'; end if;

  if selected_event.voting_status = 'OPEN' and selected_event.active_team_id is not null then
    select team.category into selected_open_category
    from public.teams team
    where team.event_id = selected_event.id and team.id = selected_event.active_team_id and team.active = true;
  end if;

  return jsonb_build_object(
    'registration', jsonb_build_object(
      'department', selected_reservation.department,
      'name', selected_reservation.attendee_name,
      'studentNumber', selected_reservation.student_number,
      'serialNumber', selected_reservation.pcu_code,
      'acceptedAt', selected_reservation.qr_checked_in_at
    ),
    'openCategory', selected_open_category,
    'votingStatus', selected_event.voting_status,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', team.id,
        'name', team.name,
        'order', team.presentation_order,
        'category', team.category
      ) order by team.presentation_order)
      from public.teams team
      where team.event_id = selected_event.id and team.active = true and team.name is not null
    ), '[]'::jsonb),
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category', ballot.category,
        'firstTeamId', ballot.first_team_id,
        'secondTeamId', ballot.second_team_id,
        'submittedAt', ballot.submitted_at
      ) order by ballot.submitted_at)
      from public.audience_rank_ballots ballot
      where ballot.event_id = selected_event.id and ballot.reservation_id = selected_reservation.id
    ), '[]'::jsonb)
  );
end;
$$;

create function public.submit_audience_rank_ballot(
  p_event_id uuid,
  p_auth_token text,
  p_category public.team_category,
  p_first_team_id uuid,
  p_second_team_id uuid
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  selected_reservation public.audience_jury_reservations%rowtype;
  active_category public.team_category;
  saved public.audience_rank_ballots%rowtype;
begin
  if p_first_team_id = p_second_team_id then raise exception 'DUPLICATE_TEAM_SELECTION'; end if;
  if length(coalesce(p_auth_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;

  select * into selected_event
  from public.events
  where id = public.resolve_attendance_event(p_event_id)
  for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.voting_status <> 'OPEN' or selected_event.active_team_id is null then
    raise exception 'VOTING_CLOSED';
  end if;
  select team.category into active_category
  from public.teams team
  where team.event_id = selected_event.id and team.id = selected_event.active_team_id and team.active = true;
  if active_category is null or active_category <> p_category then raise exception 'CATEGORY_NOT_OPEN'; end if;

  select * into selected_reservation
  from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event.id
    and reservation.session_token_hash = encode(digest(p_auth_token, 'sha256'), 'hex')
    and reservation.pcu_code is not null
    and reservation.qr_checked_in_at is not null;
  if selected_reservation.id is null then raise exception 'AUDIENCE_JURY_AUTH_REQUIRED'; end if;

  if not exists (
    select 1 from public.teams team
    where team.event_id = selected_event.id and team.id = p_first_team_id
      and team.category = p_category and team.active = true and team.name is not null
  ) or not exists (
    select 1 from public.teams team
    where team.event_id = selected_event.id and team.id = p_second_team_id
      and team.category = p_category and team.active = true and team.name is not null
  ) then raise exception 'INVALID_TEAM_SELECTION'; end if;

  begin
    insert into public.audience_rank_ballots (
      event_id, reservation_id, category, first_team_id, second_team_id
    ) values (
      selected_event.id, selected_reservation.id, p_category, p_first_team_id, p_second_team_id
    ) returning * into saved;
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;

  return jsonb_build_object(
    'category', saved.category,
    'firstTeamId', saved.first_team_id,
    'secondTeamId', saved.second_team_id,
    'submittedAt', saved.submitted_at
  );
end;
$$;

revoke all on function public.authenticate_audience_jury(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_audience_rank_ballot_state(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_audience_rank_ballot(uuid, text, public.team_category, uuid, uuid) from public, anon, authenticated;
grant execute on function public.authenticate_audience_jury(uuid, text, text, text, text) to service_role;
grant execute on function public.get_audience_rank_ballot_state(uuid, text) to service_role;
grant execute on function public.submit_audience_rank_ballot(uuid, text, public.team_category, uuid, uuid) to service_role;

comment on table public.audience_rank_ballots is
  'Raw first/second audience selections by category. No official score conversion or ranking is performed.';
