begin;

-- Audience ballots are opened by category, independently from the team that
-- happens to be active on the presentation display.
alter table public.events
  add column if not exists active_vote_category public.team_category;

create or replace function public.set_audience_category_voting_status(
  p_event_id uuid,
  p_category public.team_category,
  p_status public.voting_status
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  selected_event public.events%rowtype;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('OPEN', 'CLOSED') then raise exception 'INVALID_VOTING_STATUS'; end if;
  if not exists (
    select 1 from public.teams team
    where team.event_id = p_event_id and team.category = p_category and team.active = true and team.name is not null
  ) then raise exception 'CATEGORY_HAS_NO_TEAMS'; end if;

  select * into selected_event from public.events where id = p_event_id for update;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.status in ('FINALIZED', 'ENDED') then raise exception 'EVENT_CLOSED'; end if;
  if p_status = 'CLOSED' and
    (selected_event.voting_status <> 'OPEN' or selected_event.active_vote_category is distinct from p_category) then
    raise exception 'CATEGORY_SESSION_NOT_OPEN';
  end if;

  update public.events set
    active_vote_category = p_category,
    voting_status = p_status,
    status = case when p_status = 'OPEN' then 'VOTING_OPEN'::public.event_status else 'VOTING_CLOSED'::public.event_status end,
    display_mode = case when p_status = 'OPEN' then 'VOTE_PROGRESS' else display_mode end
  where id = p_event_id
  returning * into selected_event;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_event_id, auth.uid(),
    case when p_status = 'OPEN' then 'AUDIENCE_CATEGORY_VOTING_OPEN' else 'AUDIENCE_CATEGORY_VOTING_CLOSE' end,
    'event', p_event_id,
    jsonb_build_object('category', p_category, 'voting_status', p_status)
  );

  return jsonb_build_object(
    'eventId', selected_event.id,
    'category', selected_event.active_vote_category,
    'votingStatus', selected_event.voting_status,
    'updatedAt', now()
  );
end;
$$;

create or replace function public.get_audience_rank_ballot_state(p_event_id uuid, p_auth_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  selected_reservation public.audience_jury_reservations%rowtype;
  selected_open_category public.team_category;
begin
  if length(coalesce(p_auth_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;
  select * into selected_event from public.events where id = public.resolve_attendance_event(p_event_id);
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into selected_reservation from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event.id
    and reservation.session_token_hash = encode(digest(p_auth_token, 'sha256'), 'hex')
    and reservation.pcu_code is not null and reservation.qr_checked_in_at is not null;
  if selected_reservation.id is null then raise exception 'AUDIENCE_JURY_AUTH_REQUIRED'; end if;
  if selected_event.voting_status = 'OPEN' then selected_open_category := selected_event.active_vote_category; end if;

  return jsonb_build_object(
    'registration', jsonb_build_object(
      'department', selected_reservation.department, 'name', selected_reservation.attendee_name,
      'studentNumber', selected_reservation.student_number, 'serialNumber', selected_reservation.pcu_code,
      'acceptedAt', selected_reservation.qr_checked_in_at
    ),
    'openCategory', selected_open_category,
    'votingStatus', selected_event.voting_status,
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
      'id', team.id, 'name', team.name, 'order', team.presentation_order, 'category', team.category
    ) order by team.presentation_order) from public.teams team
      where team.event_id = selected_event.id and team.active = true and team.name is not null), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object(
      'category', ballot.category, 'firstTeamId', ballot.first_team_id,
      'secondTeamId', ballot.second_team_id, 'submittedAt', ballot.submitted_at
    ) order by ballot.submitted_at) from public.audience_rank_ballots ballot
      where ballot.event_id = selected_event.id and ballot.reservation_id = selected_reservation.id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_audience_rank_ballot(
  p_event_id uuid, p_auth_token text, p_category public.team_category,
  p_first_team_id uuid, p_second_team_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  selected_reservation public.audience_jury_reservations%rowtype;
  saved public.audience_rank_ballots%rowtype;
begin
  if p_first_team_id = p_second_team_id then raise exception 'DUPLICATE_TEAM_SELECTION'; end if;
  if length(coalesce(p_auth_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;
  select * into selected_event from public.events
    where id = public.resolve_attendance_event(p_event_id) for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.voting_status <> 'OPEN' or selected_event.active_vote_category is distinct from p_category then
    raise exception 'CATEGORY_NOT_OPEN';
  end if;

  select * into selected_reservation from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event.id
    and reservation.session_token_hash = encode(digest(p_auth_token, 'sha256'), 'hex')
    and reservation.pcu_code is not null and reservation.qr_checked_in_at is not null;
  if selected_reservation.id is null then raise exception 'AUDIENCE_JURY_AUTH_REQUIRED'; end if;

  if not exists (select 1 from public.teams team where team.event_id = selected_event.id and team.id = p_first_team_id and team.category = p_category and team.active = true and team.name is not null)
    or not exists (select 1 from public.teams team where team.event_id = selected_event.id and team.id = p_second_team_id and team.category = p_category and team.active = true and team.name is not null)
  then raise exception 'INVALID_TEAM_SELECTION'; end if;

  begin
    insert into public.audience_rank_ballots (event_id, reservation_id, category, first_team_id, second_team_id)
    values (selected_event.id, selected_reservation.id, p_category, p_first_team_id, p_second_team_id)
    returning * into saved;
  exception when unique_violation then raise exception 'ALREADY_SUBMITTED'; end;

  return jsonb_build_object('category', saved.category, 'firstTeamId', saved.first_team_id,
    'secondTeamId', saved.second_team_id, 'submittedAt', saved.submitted_at);
end;
$$;

revoke all on function public.set_audience_category_voting_status(uuid, public.team_category, public.voting_status) from public, anon, authenticated;
revoke all on function public.get_audience_rank_ballot_state(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_audience_rank_ballot(uuid, text, public.team_category, uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_audience_category_voting_status(uuid, public.team_category, public.voting_status) to authenticated;
grant execute on function public.get_audience_rank_ballot_state(uuid, text) to service_role;
grant execute on function public.submit_audience_rank_ballot(uuid, text, public.team_category, uuid, uuid) to service_role;

commit;
