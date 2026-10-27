-- Additive control-plane migration. Review and apply explicitly; it is not executed by the app.
alter table public.events
  add column if not exists version bigint not null default 1,
  add column if not exists active_team_id uuid references public.teams(id) on delete set null,
  add column if not exists display_mode text not null default 'HOLDING'
    check (display_mode in ('SPOTLIGHT', 'VOTE_PROGRESS', 'HOLDING', 'AWARD_REVEAL')),
  add column if not exists result_status text not null default 'LOCKED'
    check (result_status in ('LOCKED', 'FINALIZED', 'REVEALING', 'PUBLISHED')),
  add column if not exists reveal_step integer not null default 0 check (reveal_step >= 0);

alter table public.judge_submissions
  add column if not exists unlock_count integer not null default 0 check (unlock_count >= 0),
  add column if not exists last_unlocked_at timestamptz,
  add column if not exists last_unlock_reason text;

-- Required by the composite foreign keys below. This prevents a team from one
-- event being attached to another event's control state.
alter table public.teams
  add constraint teams_event_id_id_key unique (event_id, id);

alter table public.events
  add constraint events_active_team_same_event_fk
  foreign key (id, active_team_id) references public.teams (event_id, id);

create table if not exists public.team_vote_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null,
  status public.voting_status not null default 'READY',
  eligibility_count integer not null default 0 check (eligibility_count >= 0),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, team_id),
  foreign key (event_id, team_id) references public.teams(event_id, id) on delete cascade,
  constraint team_vote_session_time check (closed_at is null or opened_at is not null)
);

create trigger team_vote_sessions_set_updated_at before update on public.team_vote_sessions
for each row execute function public.set_updated_at();

alter table public.team_vote_sessions enable row level security;

create policy team_vote_sessions_staff_read on public.team_vote_sessions
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF', 'JUDGE'));

-- Public access is intentionally limited to event/team presentation data. Sensitive tables remain denied.
create policy events_public_read on public.events for select to anon using (true);
create policy teams_public_read on public.teams for select to anon using (active = true);

create or replace function public.bump_event_version()
returns trigger language plpgsql as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists events_bump_version on public.events;
create trigger events_bump_version before update on public.events
for each row execute function public.bump_event_version();

create function public.activate_event_team(p_event_id uuid, p_team_id uuid)
returns public.events
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events%rowtype;
  v_team public.teams%rowtype;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  select * into v_team from public.teams where id = p_team_id and event_id = p_event_id and active = true for update;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_team.id is null then raise exception 'TEAM_NOT_FOUND'; end if;
  if v_event.status in ('FINALIZED', 'ENDED') then raise exception 'EVENT_CLOSED'; end if;
  if v_team.status = 'DONE' then raise exception 'TEAM_ALREADY_COMPLETED'; end if;
  if v_event.active_team_id is not null and v_event.active_team_id <> p_team_id then
    raise exception 'ACTIVE_TEAM_MUST_BE_COMPLETED';
  end if;
  if v_event.active_team_id = p_team_id then
    return v_event;
  end if;

  update public.teams set status = 'PRESENTING' where id = p_team_id;
  insert into public.team_vote_sessions (event_id, team_id, status)
    values (p_event_id, p_team_id, 'READY')
    on conflict (event_id, team_id) do nothing;
  update public.events
    set active_team_id = p_team_id, status = 'VOTING_READY', voting_status = 'READY', display_mode = 'SPOTLIGHT'
    where id = p_event_id returning * into v_event;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
    values (p_event_id, auth.uid(), 'TEAM_PRESENTATION_START', 'team', p_team_id,
      jsonb_build_object('presentation_order', v_team.presentation_order));
  return v_event;
end;
$$;

create or replace function public.set_event_voting_status(
  p_event_id uuid,
  p_status public.voting_status
)
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

  if p_status in ('OPEN', 'CLOSED') and v_event.active_team_id is null then
    raise exception 'NO_ACTIVE_TEAM';
  end if;

  if v_event.active_team_id is not null then
    select * into v_session
    from public.team_vote_sessions
    where event_id = p_event_id and team_id = v_event.active_team_id
    for update;
    if v_session.id is null then raise exception 'VOTE_SESSION_NOT_FOUND'; end if;
  end if;

  if p_status = 'OPEN' then
    if v_session.status <> 'READY' then raise exception 'VOTE_SESSION_NOT_READY'; end if;
    select
      (select count(*) from public.check_ins where event_id = p_event_id) +
      (select count(*) from public.audience_attendance_sessions where event_id = p_event_id and exited_at is null)
    into v_eligibility_count;
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
        else 'VOTING_CLOSED'::public.event_status
      end,
      display_mode = case when p_status = 'OPEN' then 'VOTE_PROGRESS' else display_mode end
  where id = p_event_id
  returning * into v_event;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(),
    case when p_status = 'OPEN' then 'VOTING_OPEN' when p_status = 'CLOSED' then 'VOTING_CLOSE' else 'VOTING_READY' end,
    'event', p_event_id,
    jsonb_build_object('voting_status', p_status, 'team_id', v_event.active_team_id,
      'eligibility_count', case when p_status = 'OPEN' then v_eligibility_count else null end));
  return v_event;
end;
$$;

create function public.complete_event_team(p_event_id uuid)
returns public.events
language plpgsql security definer set search_path = public as $$
declare v_event public.events%rowtype;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if v_event.active_team_id is null then raise exception 'NO_ACTIVE_TEAM'; end if;
  update public.teams set status = 'DONE' where id = v_event.active_team_id and event_id = p_event_id;
  update public.team_vote_sessions
    set status = 'CLOSED', closed_at = case when opened_at is null then null else now() end, updated_at = now()
    where event_id = p_event_id and team_id = v_event.active_team_id;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id)
    values (p_event_id, auth.uid(), 'TEAM_PRESENTATION_COMPLETE', 'team', v_event.active_team_id);
  update public.events
    set active_team_id = null, status = 'VOTING_CLOSED', voting_status = 'CLOSED', display_mode = 'HOLDING'
    where id = p_event_id returning * into v_event;
  return v_event;
end;
$$;

create function public.set_event_display_mode(p_event_id uuid, p_display_mode text)
returns public.events
language plpgsql security definer set search_path = public as $$
declare v_event public.events%rowtype;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  if p_display_mode not in ('SPOTLIGHT', 'VOTE_PROGRESS', 'HOLDING', 'AWARD_REVEAL') then raise exception 'INVALID_DISPLAY_MODE'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if p_display_mode = 'AWARD_REVEAL' and v_event.result_status = 'LOCKED' then raise exception 'RESULT_LOCKED'; end if;
  update public.events set display_mode = p_display_mode where id = p_event_id returning * into v_event;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
    values (p_event_id, auth.uid(), 'DISPLAY_MODE_CHANGE', 'event', p_event_id,
      jsonb_build_object('display_mode', p_display_mode));
  return v_event;
end;
$$;

create function public.set_event_reveal_step(p_event_id uuid, p_reveal_step integer)
returns public.events
language plpgsql security definer set search_path = public as $$
declare v_event public.events%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if v_event.result_status = 'LOCKED' then raise exception 'RESULT_LOCKED'; end if;
  update public.events set display_mode = 'AWARD_REVEAL', result_status = 'REVEALING', reveal_step = p_reveal_step
    where id = p_event_id returning * into v_event;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
    values (p_event_id, auth.uid(), 'AWARD_REVEAL_STEP', 'event', p_event_id,
      jsonb_build_object('reveal_step', p_reveal_step));
  return v_event;
end;
$$;

create function public.unlock_judge_submission(p_submission_id uuid, p_reason text)
returns public.judge_submissions
language plpgsql security definer set search_path = public as $$
declare v_submission public.judge_submissions%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'UNLOCK_REASON_REQUIRED'; end if;
  select * into v_submission from public.judge_submissions where id = p_submission_id for update;
  if v_submission.id is null then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if v_submission.status <> 'SUBMITTED' then raise exception 'SUBMISSION_NOT_LOCKED'; end if;
  update public.judge_submissions
    set status = 'DRAFT', submitted_at = null, unlock_count = unlock_count + 1,
        last_unlocked_at = now(), last_unlock_reason = trim(p_reason)
    where id = p_submission_id returning * into v_submission;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
    values (v_submission.event_id, auth.uid(), 'JUDGE_SUBMISSION_UNLOCK', 'judge_submission', p_submission_id,
      jsonb_build_object('reason', trim(p_reason), 'scores_preserved', true));
  return v_submission;
end;
$$;

create or replace function public.reset_rehearsal_event(p_event_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_mode public.event_mode;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  select mode into v_mode from public.events where id = p_event_id for update;
  if v_mode is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_mode <> 'REHEARSAL' then raise exception 'LIVE_RESET_FORBIDDEN'; end if;

  delete from public.prize_draws where event_id = p_event_id;
  delete from public.result_snapshots where event_id = p_event_id;
  delete from public.audience_scores
    where submission_id in (select id from public.audience_submissions where event_id = p_event_id);
  delete from public.audience_submissions where event_id = p_event_id;
  delete from public.judge_scores
    where submission_id in (select id from public.judge_submissions where event_id = p_event_id);
  delete from public.judge_submissions where event_id = p_event_id;
  delete from public.team_vote_sessions where event_id = p_event_id;
  delete from public.audience_attendance_sessions where event_id = p_event_id;
  delete from public.check_ins where event_id = p_event_id;
  delete from public.audit_logs where event_id = p_event_id;
  update public.teams set status = 'WAITING' where event_id = p_event_id;
  update public.events
    set status = 'SETUP', voting_status = 'READY', active_team_id = null,
        display_mode = 'HOLDING', result_status = 'LOCKED', reveal_step = 0
    where id = p_event_id;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id)
  values (p_event_id, auth.uid(), 'REHEARSAL_RESET', 'event', p_event_id);
end;
$$;

revoke all on function public.activate_event_team(uuid, uuid) from public;
revoke all on function public.complete_event_team(uuid) from public;
revoke all on function public.set_event_voting_status(uuid, public.voting_status) from public;
revoke all on function public.set_event_display_mode(uuid, text) from public;
revoke all on function public.set_event_reveal_step(uuid, integer) from public;
revoke all on function public.unlock_judge_submission(uuid, text) from public;
revoke all on function public.reset_rehearsal_event(uuid) from public;
grant execute on function public.activate_event_team(uuid, uuid) to authenticated;
grant execute on function public.complete_event_team(uuid) to authenticated;
grant execute on function public.set_event_voting_status(uuid, public.voting_status) to authenticated;
grant execute on function public.set_event_display_mode(uuid, text) to authenticated;
grant execute on function public.set_event_reveal_step(uuid, integer) to authenticated;
grant execute on function public.unlock_judge_submission(uuid, text) to authenticated;
grant execute on function public.reset_rehearsal_event(uuid) to authenticated;
