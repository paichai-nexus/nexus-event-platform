-- Persistent audience voting and judge submission bridge.
-- Apply only after 001-011 have succeeded in order. Never stores plaintext browser tokens.

alter table public.audience_attendance_sessions
  add column if not exists participant_id uuid;

alter table public.participants
  add constraint participants_event_id_id_key unique (event_id, id);

-- Preserve existing attendance rows by linking each hashed browser credential to
-- a stable participant row. No existing attendance or submission is deleted.
do $$
declare
  attendance record;
  linked_participant_id uuid;
begin
  for attendance in
    select id, event_id, session_token_hash, participant_label
    from public.audience_attendance_sessions
    where participant_id is null
    order by created_at, id
  loop
    insert into public.participants (
      event_id, participant_code, display_label, access_token_hash, active
    ) values (
      attendance.event_id,
      'ATT-' || attendance.session_token_hash,
      attendance.participant_label,
      attendance.session_token_hash,
      true
    )
    on conflict (event_id, access_token_hash) do update
      set access_token_hash = excluded.access_token_hash
    returning id into linked_participant_id;

    update public.audience_attendance_sessions
      set participant_id = linked_participant_id
      where id = attendance.id;
  end loop;
end;
$$;

alter table public.audience_attendance_sessions
  alter column participant_id set not null,
  add constraint audience_attendance_participant_fk
    foreign key (participant_id) references public.participants(id) on delete restrict,
  add constraint audience_attendance_participant_same_event_fk
    foreign key (event_id, participant_id) references public.participants(event_id, id) on delete restrict,
  add constraint audience_attendance_event_participant_key unique (event_id, participant_id);

alter table public.audience_submissions
  add column if not exists vote_session_id uuid;

alter table public.team_vote_sessions
  add constraint team_vote_sessions_event_team_id_key unique (event_id, team_id, id);

-- Historical submissions are attached to a closed session instead of being
-- overwritten or discarded.
insert into public.team_vote_sessions (
  event_id, team_id, status, eligibility_count, opened_at, closed_at
)
select
  submission.event_id,
  submission.team_id,
  'CLOSED'::public.voting_status,
  count(distinct submission.participant_id)::integer,
  min(submission.submitted_at),
  max(submission.submitted_at)
from public.audience_submissions submission
left join public.team_vote_sessions session
  on session.event_id = submission.event_id and session.team_id = submission.team_id
where session.id is null
group by submission.event_id, submission.team_id
on conflict (event_id, team_id) do nothing;

update public.audience_submissions submission
set vote_session_id = session.id
from public.team_vote_sessions session
where submission.vote_session_id is null
  and session.event_id = submission.event_id
  and session.team_id = submission.team_id;

do $$
begin
  if exists (select 1 from public.audience_submissions where vote_session_id is null) then
    raise exception 'AUDIENCE_SUBMISSION_SESSION_BACKFILL_REQUIRED';
  end if;
end;
$$;

alter table public.audience_submissions
  alter column vote_session_id set not null,
  add constraint audience_submission_vote_session_fk
    foreign key (vote_session_id) references public.team_vote_sessions(id) on delete restrict,
  add constraint audience_submission_participant_same_event_fk
    foreign key (event_id, participant_id) references public.participants(event_id, id) on delete restrict,
  add constraint audience_submission_team_same_event_fk
    foreign key (event_id, team_id) references public.teams(event_id, id) on delete restrict,
  add constraint audience_submission_session_same_team_fk
    foreign key (event_id, team_id, vote_session_id)
    references public.team_vote_sessions(event_id, team_id, id) on delete restrict,
  add constraint audience_submission_one_per_session unique (vote_session_id, participant_id);

alter table public.judge_assignments
  add constraint judge_assignment_team_same_event_fk
    foreign key (event_id, team_id) references public.teams(event_id, id) on delete cascade;

alter table public.judge_submissions
  add constraint judge_submission_team_same_event_fk
    foreign key (event_id, team_id) references public.teams(event_id, id) on delete restrict;

create table public.judge_score_revisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.judge_submissions(id) on delete restrict,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete restrict,
  previous_score numeric(8, 2) not null,
  revision integer not null check (revision > 0),
  unlock_count integer not null default 0 check (unlock_count >= 0),
  changed_by uuid references auth.users(id) on delete set null,
  change_kind text not null check (change_kind in ('UPDATE', 'DELETE')),
  changed_at timestamptz not null default now(),
  unique (submission_id, criterion_id, revision)
);

alter table public.judge_score_revisions enable row level security;

create policy judge_score_revisions_staff_or_owner_read on public.judge_score_revisions
for select to authenticated
using (
  public.current_app_role() in ('ADMIN', 'STAFF') or
  exists (
    select 1 from public.judge_submissions submission
    where submission.id = judge_score_revisions.submission_id
      and submission.judge_user_id = auth.uid()
  )
);

create function public.capture_judge_score_revision()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  next_revision integer;
  current_unlock_count integer;
begin
  select coalesce(max(revision), 0) + 1
    into next_revision
    from public.judge_score_revisions
    where submission_id = old.submission_id and criterion_id = old.criterion_id;
  select unlock_count into current_unlock_count
    from public.judge_submissions where id = old.submission_id;

  insert into public.judge_score_revisions (
    submission_id, criterion_id, previous_score, revision,
    unlock_count, changed_by, change_kind
  ) values (
    old.submission_id, old.criterion_id, old.score, next_revision,
    coalesce(current_unlock_count, 0), auth.uid(), tg_op
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger judge_scores_capture_revision
before update or delete on public.judge_scores
for each row execute function public.capture_judge_score_revision();

create or replace function public.enter_audience_attendance(p_event_id uuid, p_session_token text)
returns table (known boolean, active boolean, participant_id text, entered_at timestamptz, active_count bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event_id uuid;
  token_hash text;
  stable_participant_id uuid;
  participant_label text;
begin
  if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  token_hash := encode(digest(p_session_token, 'sha256'), 'hex');
  participant_label := 'AUD-' || upper(substr(token_hash, 1, 8));

  insert into public.participants (
    event_id, participant_code, display_label, access_token_hash, active
  ) values (
    selected_event_id, 'ATT-' || token_hash, participant_label, token_hash, true
  )
  on conflict (event_id, access_token_hash) do update
    set access_token_hash = excluded.access_token_hash
  returning id into stable_participant_id;

  insert into public.audience_attendance_sessions (
    event_id, participant_id, session_token_hash, participant_label
  ) values (
    selected_event_id, stable_participant_id, token_hash, participant_label
  )
  on conflict (event_id, session_token_hash) do update
    set entered_at = now(), exited_at = null;

  return query select * from public.get_audience_attendance(selected_event_id, p_session_token);
end;
$$;

create function public.get_audience_vote_state(p_event_id uuid, p_session_token text)
returns table (
  eligible boolean,
  voting_status public.voting_status,
  team_id uuid,
  submission_id uuid,
  submitted_at timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  selected_event_id uuid;
  stable_participant_id uuid;
begin
  if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  select * into selected_event from public.events
    where id = selected_event_id for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  select attendance.participant_id into stable_participant_id
  from public.audience_attendance_sessions attendance
  where attendance.event_id = selected_event_id
    and attendance.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    and attendance.exited_at is null;

  return query
  select
    stable_participant_id is not null,
    selected_event.voting_status,
    selected_event.active_team_id,
    submission.id,
    submission.submitted_at
  from (select 1) singleton
  left join public.team_vote_sessions session
    on session.event_id = selected_event.id
    and session.team_id = selected_event.active_team_id
  left join public.audience_submissions submission
    on submission.vote_session_id = session.id
    and submission.participant_id = stable_participant_id;
end;
$$;

create function public.submit_audience_vote(p_event_id uuid, p_session_token text)
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
  select * into selected_event from public.events where id = selected_event_id for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.voting_status <> 'OPEN' or selected_event.active_team_id is null then
    raise exception 'VOTING_CLOSED';
  end if;

  select * into selected_session from public.team_vote_sessions
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

  insert into public.audience_submissions (
    event_id, participant_id, team_id, vote_session_id
  ) values (
    selected_event_id, stable_participant_id, selected_event.active_team_id, selected_session.id
  )
  on conflict (vote_session_id, participant_id) do update
    set submitted_at = public.audience_submissions.submitted_at
  returning * into saved_submission;

  return saved_submission;
end;
$$;

create function public.get_audience_vote_snapshot(p_event_id uuid)
returns table (team_id uuid, vote_count bigint, eligibility_count integer)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  return query
  select session.team_id, count(submission.id), session.eligibility_count
  from public.team_vote_sessions session
  left join public.audience_submissions submission on submission.vote_session_id = session.id
  where session.event_id = p_event_id
  group by session.id, session.team_id, session.eligibility_count;
end;
$$;

create function public.save_judge_scores(p_event_id uuid, p_team_id uuid, p_scores jsonb)
returns public.judge_submissions
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  saved_submission public.judge_submissions%rowtype;
  score_item jsonb;
  criterion_uuid uuid;
  score_value numeric;
begin
  if public.current_app_role() is distinct from 'JUDGE'::public.app_role then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_scores) <> 'array' then raise exception 'INVALID_SCORES'; end if;
  select * into selected_event from public.events where id = p_event_id for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.status in ('FINALIZED', 'ENDED') or selected_event.result_status <> 'LOCKED' then
    raise exception 'RESULT_FINALIZED';
  end if;
  if not exists (
    select 1 from public.judge_assignments assignment
    where assignment.event_id = p_event_id and assignment.team_id = p_team_id
      and assignment.judge_user_id = auth.uid() and assignment.active = true
  ) then raise exception 'ASSIGNMENT_REQUIRED'; end if;

  insert into public.judge_submissions (event_id, judge_user_id, team_id)
  values (p_event_id, auth.uid(), p_team_id)
  on conflict (event_id, judge_user_id, team_id) do update
    set updated_at = public.judge_submissions.updated_at
  returning * into saved_submission;
  if saved_submission.status <> 'DRAFT' then raise exception 'FINAL_SUBMISSION_READ_ONLY'; end if;

  for score_item in select value from jsonb_array_elements(p_scores)
  loop
    criterion_uuid := (score_item ->> 'criterionId')::uuid;
    score_value := (score_item ->> 'score')::numeric;
    if not exists (
      select 1 from public.evaluation_criteria criterion
      where criterion.id = criterion_uuid and criterion.event_id = p_event_id
        and criterion.scope = 'JUDGE' and criterion.active = true
    ) then raise exception 'INVALID_CRITERION'; end if;
    insert into public.judge_scores (submission_id, criterion_id, score)
    values (saved_submission.id, criterion_uuid, score_value)
    on conflict (submission_id, criterion_id) do update set score = excluded.score
      where public.judge_scores.score is distinct from excluded.score;
  end loop;
  update public.judge_submissions set updated_at = now() where id = saved_submission.id
    returning * into saved_submission;
  return saved_submission;
end;
$$;

create function public.submit_judge_scores(p_event_id uuid, p_team_id uuid)
returns public.judge_submissions
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event public.events%rowtype;
  saved_submission public.judge_submissions%rowtype;
begin
  if public.current_app_role() is distinct from 'JUDGE'::public.app_role then raise exception 'FORBIDDEN'; end if;
  select * into selected_event from public.events where id = p_event_id for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.status in ('FINALIZED', 'ENDED') or selected_event.result_status <> 'LOCKED' then
    raise exception 'RESULT_FINALIZED';
  end if;
  select * into saved_submission from public.judge_submissions
    where event_id = p_event_id and team_id = p_team_id and judge_user_id = auth.uid()
    for update;
  if saved_submission.id is null then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if saved_submission.status <> 'DRAFT' then return saved_submission; end if;
  if not exists (
    select 1 from public.evaluation_criteria criterion
    where criterion.event_id = p_event_id and criterion.scope = 'JUDGE' and criterion.active = true
  ) then raise exception 'CRITERIA_NOT_CONFIGURED'; end if;
  if exists (
    select 1 from public.evaluation_criteria criterion
    where criterion.event_id = p_event_id and criterion.scope = 'JUDGE' and criterion.active = true
      and not exists (
        select 1 from public.judge_scores score
        where score.submission_id = saved_submission.id and score.criterion_id = criterion.id
      )
  ) then raise exception 'INCOMPLETE_SCORES'; end if;

  update public.judge_submissions
    set status = 'SUBMITTED', submitted_at = now()
    where id = saved_submission.id
    returning * into saved_submission;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id)
  values (p_event_id, auth.uid(), 'JUDGE_SUBMISSION_SUBMIT', 'judge_submission', saved_submission.id);
  return saved_submission;
end;
$$;

create or replace function public.unlock_judge_submission(p_submission_id uuid, p_reason text)
returns public.judge_submissions
language plpgsql security definer set search_path = public, extensions as $$
declare
  saved_submission public.judge_submissions%rowtype;
  selected_event public.events%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'UNLOCK_REASON_REQUIRED'; end if;
  select * into saved_submission from public.judge_submissions where id = p_submission_id;
  if saved_submission.id is null then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  select * into selected_event from public.events where id = saved_submission.event_id for share;
  if selected_event.status in ('FINALIZED', 'ENDED') or selected_event.result_status <> 'LOCKED' then
    raise exception 'RESULT_FINALIZED';
  end if;
  select * into saved_submission from public.judge_submissions where id = p_submission_id for update;
  if saved_submission.status <> 'SUBMITTED' then raise exception 'SUBMISSION_NOT_LOCKED'; end if;
  update public.judge_submissions
    set status = 'DRAFT', submitted_at = null, unlock_count = unlock_count + 1,
        last_unlocked_at = now(), last_unlock_reason = trim(p_reason)
    where id = p_submission_id returning * into saved_submission;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (saved_submission.event_id, auth.uid(), 'JUDGE_SUBMISSION_UNLOCK', 'judge_submission', p_submission_id,
    jsonb_build_object('reason', trim(p_reason), 'scores_preserved', true,
      'judge_user_id', saved_submission.judge_user_id, 'team_id', saved_submission.team_id));
  return saved_submission;
end;
$$;

revoke all on function public.capture_judge_score_revision() from public;
revoke all on function public.get_audience_vote_state(uuid, text) from public;
revoke all on function public.submit_audience_vote(uuid, text) from public;
revoke all on function public.get_audience_vote_snapshot(uuid) from public;
revoke all on function public.save_judge_scores(uuid, uuid, jsonb) from public;
revoke all on function public.submit_judge_scores(uuid, uuid) from public;
revoke insert, update, delete on public.audience_submissions, public.audience_scores from anon, authenticated;
revoke insert, update, delete on public.judge_submissions, public.judge_scores, public.judge_score_revisions from anon, authenticated;
grant select on public.audience_submissions, public.audience_scores to authenticated;
grant select on public.judge_submissions, public.judge_scores, public.judge_score_revisions to authenticated;
grant execute on function public.get_audience_vote_state(uuid, text) to anon, authenticated;
grant execute on function public.submit_audience_vote(uuid, text) to anon, authenticated;
grant execute on function public.get_audience_vote_snapshot(uuid) to authenticated;
grant execute on function public.save_judge_scores(uuid, uuid, jsonb) to authenticated;
grant execute on function public.submit_judge_scores(uuid, uuid) to authenticated;
