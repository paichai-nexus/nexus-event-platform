-- P0-A hardening: browser clients must use the server API boundary for public
-- snapshots, attendance credentials, and votes. Existing rows are preserved.

drop policy if exists events_public_read on public.events;
drop policy if exists teams_public_read on public.teams;
revoke select on public.events, public.teams from anon;

revoke execute on function public.get_audience_attendance(uuid, text) from anon, authenticated;
revoke execute on function public.enter_audience_attendance(uuid, text) from anon, authenticated;
revoke execute on function public.exit_audience_attendance(uuid, text) from anon, authenticated;
revoke execute on function public.get_audience_vote_state(uuid, text) from anon, authenticated;
revoke execute on function public.submit_audience_vote(uuid, text) from anon, authenticated;

grant execute on function public.get_audience_attendance(uuid, text) to service_role;
grant execute on function public.enter_audience_attendance(uuid, text) to service_role;
grant execute on function public.exit_audience_attendance(uuid, text) to service_role;
grant execute on function public.get_audience_vote_state(uuid, text) to service_role;
grant execute on function public.submit_audience_vote(uuid, text) to service_role;

-- A retry or concurrent duplicate must not appear as a new official vote. The
-- unique constraint remains the final concurrency guard; the RPC now reports a
-- stable domain error instead of silently returning the previous submission.
create or replace function public.submit_audience_vote(p_event_id uuid, p_session_token text)
returns public.audience_submissions
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  selected_session public.team_vote_sessions%rowtype;
  selected_event_id uuid;
  stable_participant_id uuid;
  saved_submission public.audience_submissions%rowtype;
begin
  if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  select * into selected_event
  from public.events
  where id = selected_event_id
  for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.voting_status <> 'OPEN' or selected_event.active_team_id is null then
    raise exception 'VOTING_CLOSED';
  end if;

  select * into selected_session
  from public.team_vote_sessions
  where event_id = selected_event_id and team_id = selected_event.active_team_id
  for update;
  if selected_session.id is null or selected_session.status <> 'OPEN' then
    raise exception 'VOTING_CLOSED';
  end if;

  select attendance.participant_id into stable_participant_id
  from public.audience_attendance_sessions attendance
  join public.participants participant on participant.id = attendance.participant_id
  where attendance.event_id = selected_event_id
    and attendance.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    and attendance.exited_at is null
    and attendance.entered_at <= selected_session.opened_at
    and participant.active = true;
  if stable_participant_id is null then raise exception 'NOT_ELIGIBLE'; end if;

  begin
    insert into public.audience_submissions (
      event_id, participant_id, team_id, vote_session_id
    ) values (
      selected_event_id, stable_participant_id, selected_event.active_team_id, selected_session.id
    ) returning * into saved_submission;
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;

  return saved_submission;
end;
$$;

revoke all on function public.submit_audience_vote(uuid, text) from public;
grant execute on function public.submit_audience_vote(uuid, text) to service_role;
