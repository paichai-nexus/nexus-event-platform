create table public.audience_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  session_token_hash text not null,
  participant_label text not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, session_token_hash)
);

create index audience_attendance_active_idx
  on public.audience_attendance_sessions (event_id, entered_at desc)
  where exited_at is null;

create trigger audience_attendance_set_updated_at
before update on public.audience_attendance_sessions
for each row execute function public.set_updated_at();

alter table public.audience_attendance_sessions enable row level security;

create policy audience_attendance_staff_read on public.audience_attendance_sessions
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

create function public.resolve_attendance_event(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.events
  where (p_event_id is null or id = p_event_id)
    and status not in ('FINALIZED', 'ENDED')
  order by starts_at desc
  limit 1;
$$;

create function public.get_audience_attendance(p_event_id uuid, p_session_token text)
returns table (known boolean, active boolean, participant_id text, entered_at timestamptz, active_count bigint)
language sql
security definer
set search_path = public
as $$
  with selected_event as (
    select public.resolve_attendance_event(p_event_id) as event_id
  ), own_record as (
    select attendance.participant_label, attendance.entered_at, attendance.exited_at
    from public.audience_attendance_sessions attendance, selected_event
    where attendance.event_id = selected_event.event_id
      and attendance.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
  )
  select
    own_record.participant_label is not null,
    coalesce(own_record.exited_at is null and own_record.participant_label is not null, false),
    coalesce(own_record.participant_label, 'AUD-' || upper(substr(encode(digest(p_session_token, 'sha256'), 'hex'), 1, 8))),
    case when own_record.exited_at is null then own_record.entered_at else null end,
    (select count(*) from public.check_ins check_in where check_in.event_id = selected_event.event_id) +
      (select count(*) from public.audience_attendance_sessions attendance where attendance.event_id = selected_event.event_id and attendance.exited_at is null)
  from selected_event
  left join own_record on true;
$$;

create function public.enter_audience_attendance(p_event_id uuid, p_session_token text)
returns table (known boolean, active boolean, participant_id text, entered_at timestamptz, active_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_hash text;
begin
  if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
  v_event_id := public.resolve_attendance_event(p_event_id);
  if v_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  v_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  insert into public.audience_attendance_sessions (event_id, session_token_hash, participant_label)
  values (v_event_id, v_hash, 'AUD-' || upper(substr(v_hash, 1, 8)))
  on conflict (event_id, session_token_hash) do update
  set entered_at = now(), exited_at = null;

  return query select * from public.get_audience_attendance(v_event_id, p_session_token);
end;
$$;

create function public.exit_audience_attendance(p_event_id uuid, p_session_token text)
returns table (known boolean, active boolean, participant_id text, entered_at timestamptz, active_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  v_event_id := public.resolve_attendance_event(p_event_id);
  if v_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  update public.audience_attendance_sessions
  set exited_at = now()
  where event_id = v_event_id
    and session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    and exited_at is null;

  return query select * from public.get_audience_attendance(v_event_id, p_session_token);
end;
$$;

revoke all on public.audience_attendance_sessions from anon;
revoke all on function public.resolve_attendance_event(uuid) from public;
revoke all on function public.get_audience_attendance(uuid, text) from public;
revoke all on function public.enter_audience_attendance(uuid, text) from public;
revoke all on function public.exit_audience_attendance(uuid, text) from public;
grant execute on function public.get_audience_attendance(uuid, text) to anon, authenticated;
grant execute on function public.enter_audience_attendance(uuid, text) to anon, authenticated;
grant execute on function public.exit_audience_attendance(uuid, text) to anon, authenticated;

create or replace function public.reset_rehearsal_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode public.event_mode;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'FORBIDDEN';
  end if;
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
  delete from public.audience_attendance_sessions where event_id = p_event_id;
  delete from public.check_ins where event_id = p_event_id;
  delete from public.audit_logs where event_id = p_event_id;
  update public.events set status = 'SETUP', voting_status = 'READY' where id = p_event_id;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id)
  values (p_event_id, auth.uid(), 'REHEARSAL_RESET', 'event', p_event_id);
end;
$$;
