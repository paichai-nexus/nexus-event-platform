-- Standalone audience-voter registration. A registration is NOT a physical attendance record.
-- Existing attendance participants are grandfathered into voter registration.
create table public.audience_vote_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null,
  session_token_hash text not null,
  registered_at timestamptz not null default now(),
  unique (event_id, participant_id),
  unique (event_id, session_token_hash),
  foreign key (event_id, participant_id)
    references public.participants(event_id, id) on delete restrict
);
create index audience_vote_registration_event_idx on public.audience_vote_registrations(event_id, registered_at);
alter table public.audience_vote_registrations enable row level security;
revoke all on public.audience_vote_registrations from anon, authenticated;

insert into public.audience_vote_registrations(event_id, participant_id, session_token_hash, registered_at)
select event_id, participant_id, session_token_hash, entered_at
from public.audience_attendance_sessions
on conflict (event_id, session_token_hash) do nothing;

create function public.register_audience_voter(p_event_id uuid, p_session_token text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event_id uuid;
  token_hash text;
  stable_participant_id uuid;
begin
  if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  insert into public.participants(event_id, participant_code, display_label, access_token_hash, active)
  values (selected_event_id, 'VOT-' || token_hash, 'VOT-' || upper(substr(token_hash, 1, 8)), token_hash, true)
  on conflict (event_id, access_token_hash) do update
    set access_token_hash = excluded.access_token_hash
  returning id into stable_participant_id;

  insert into public.audience_vote_registrations(event_id, participant_id, session_token_hash)
  values (selected_event_id, stable_participant_id, token_hash)
  on conflict (event_id, session_token_hash) do nothing;

  -- A late registration is allowed while voting is open; keep official eligibility counts coherent.
  update public.team_vote_sessions session
    set eligibility_count = (select count(*)::integer from public.audience_vote_registrations registration
                             where registration.event_id = selected_event_id)
    where session.event_id = selected_event_id and session.status = 'OPEN';
  return true;
end;
$$;

create or replace function public.get_audience_vote_state(p_event_id uuid, p_session_token text)
returns table (
  eligible boolean, voting_status public.voting_status, team_id uuid,
  submission_id uuid, submitted_at timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  stable_participant_id uuid;
begin
  if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
  select * into selected_event from public.events
    where id = public.resolve_attendance_event(p_event_id) for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  select registration.participant_id into stable_participant_id
  from public.audience_vote_registrations registration
  join public.participants participant on participant.id = registration.participant_id
  where registration.event_id = selected_event.id
    and registration.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    and participant.active = true;

  return query
  select stable_participant_id is not null, selected_event.voting_status,
    selected_event.active_team_id, submission.id, submission.submitted_at
  from (select 1) singleton
  left join public.team_vote_sessions session
    on session.event_id = selected_event.id and session.team_id = selected_event.active_team_id
  left join public.audience_submissions submission
    on submission.vote_session_id = session.id and submission.participant_id = stable_participant_id;
end;
$$;

create or replace function public.submit_audience_vote(p_event_id uuid, p_session_token text)
returns public.audience_submissions
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  selected_session public.team_vote_sessions%rowtype;
  stable_participant_id uuid;
  saved_submission public.audience_submissions%rowtype;
begin
  if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
  select * into selected_event from public.events
    where id = public.resolve_attendance_event(p_event_id) for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.voting_status <> 'OPEN' or selected_event.active_team_id is null then
    raise exception 'VOTING_CLOSED';
  end if;
  select * into selected_session from public.team_vote_sessions
    where event_id = selected_event.id and team_id = selected_event.active_team_id for update;
  if selected_session.id is null or selected_session.status <> 'OPEN' then raise exception 'VOTING_CLOSED'; end if;

  select registration.participant_id into stable_participant_id
  from public.audience_vote_registrations registration
  join public.participants participant on participant.id = registration.participant_id
  where registration.event_id = selected_event.id
    and registration.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    and participant.active = true;
  if stable_participant_id is null then raise exception 'NOT_ELIGIBLE'; end if;

  begin
    insert into public.audience_submissions(event_id, participant_id, team_id, vote_session_id)
      values(selected_event.id, stable_participant_id, selected_event.active_team_id, selected_session.id)
    returning * into saved_submission;
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;
  return saved_submission;
end;
$$;

-- Override the existing open-count function: eligibility means voter registration, not attendance.
create or replace function public.set_event_voting_status(p_event_id uuid, p_status public.voting_status)
returns public.events
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events%rowtype;
  v_session public.team_vote_sessions%rowtype;
  v_eligibility_count integer;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.status in ('FINALIZED', 'ENDED') then raise exception 'EVENT_CLOSED'; end if;
  if p_status in ('OPEN', 'CLOSED') and v_event.active_team_id is null then raise exception 'NO_ACTIVE_TEAM'; end if;
  if v_event.active_team_id is not null then
    select * into v_session from public.team_vote_sessions
      where event_id = p_event_id and team_id = v_event.active_team_id for update;
    if v_session.id is null then raise exception 'VOTE_SESSION_NOT_FOUND'; end if;
  end if;
  if p_status = 'OPEN' then
    if v_session.status <> 'READY' then raise exception 'VOTE_SESSION_NOT_READY'; end if;
    select count(*)::integer into v_eligibility_count from public.audience_vote_registrations
      where event_id = p_event_id;
    update public.team_vote_sessions
      set status = 'OPEN', eligibility_count = v_eligibility_count, opened_at = now(), closed_at = null
      where id = v_session.id;
  elsif p_status = 'CLOSED' then
    if v_session.status <> 'OPEN' then raise exception 'VOTE_SESSION_NOT_OPEN'; end if;
    update public.team_vote_sessions set status = 'CLOSED', closed_at = now() where id = v_session.id;
  elsif v_event.active_team_id is not null and v_session.status <> 'READY' then
    raise exception 'VOTE_SESSION_ALREADY_STARTED';
  end if;
  update public.events
    set voting_status = p_status,
      status = case
        when p_status = 'READY' then 'VOTING_READY'::public.event_status
        when p_status = 'OPEN' then 'VOTING_OPEN'::public.event_status
        else 'VOTING_CLOSED'::public.event_status end,
      display_mode = case when p_status = 'OPEN' then 'VOTE_PROGRESS' else display_mode end
    where id = p_event_id returning * into v_event;
  insert into public.audit_logs(event_id, actor_user_id, action, target_type, target_id, metadata)
    values (p_event_id, auth.uid(),
      case when p_status = 'OPEN' then 'VOTING_OPEN'
           when p_status = 'CLOSED' then 'VOTING_CLOSE' else 'VOTING_READY' end,
      'event', p_event_id,
      jsonb_build_object('voting_status', p_status, 'team_id', v_event.active_team_id,
        'eligibility_count', case when p_status = 'OPEN' then v_eligibility_count else null end));
  return v_event;
end;
$$;

revoke all on function public.register_audience_voter(uuid, text) from public;
grant execute on function public.register_audience_voter(uuid, text) to service_role;
