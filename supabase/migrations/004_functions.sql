create function public.perform_check_in(
  p_event_id uuid,
  p_participant_code text,
  p_checked_in_by uuid,
  p_source public.check_in_source
)
returns table (
  status text,
  participant_id uuid,
  participant_code text,
  checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
  v_check_in public.check_ins%rowtype;
begin
  if auth.uid() is null or p_checked_in_by is distinct from auth.uid() then
    raise exception 'UNAUTHORIZED';
  end if;
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then
    raise exception 'FORBIDDEN';
  end if;

  if p_event_id is null then
    select * into v_event from public.events
    where status in ('SETUP', 'CHECK_IN_OPEN', 'VOTING_READY', 'VOTING_OPEN', 'VOTING_CLOSED', 'JUDGING', 'SCORING')
    order by starts_at desc limit 1;
  else
    select * into v_event from public.events where id = p_event_id;
  end if;

  if v_event.id is null then
    return query select 'INVALID_EVENT'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select * into v_participant from public.participants
  where event_id = v_event.id and upper(participant_code) = upper(trim(p_participant_code));

  if v_participant.id is null then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;
  if not v_participant.active then
    return query select 'INACTIVE'::text, v_participant.id, v_participant.participant_code, null::timestamptz;
    return;
  end if;

  insert into public.check_ins (event_id, participant_id, checked_in_by, source)
  values (v_event.id, v_participant.id, auth.uid(), p_source)
  on conflict (event_id, participant_id) do nothing
  returning * into v_check_in;

  if v_check_in.id is null then
    select * into v_check_in from public.check_ins
    where event_id = v_event.id and participant_id = v_participant.id;
    return query select 'ALREADY_CHECKED_IN'::text, v_participant.id,
      v_participant.participant_code, v_check_in.checked_in_at;
    return;
  end if;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    v_event.id,
    auth.uid(),
    'CHECK_IN',
    'participant',
    v_participant.id,
    jsonb_build_object('source', p_source, 'participant_code', v_participant.participant_code)
  );

  return query select 'SUCCESS'::text, v_participant.id,
    v_participant.participant_code, v_check_in.checked_in_at;
end;
$$;

revoke all on function public.perform_check_in(uuid, text, uuid, public.check_in_source) from public;
grant execute on function public.perform_check_in(uuid, text, uuid, public.check_in_source) to authenticated;

create function public.validate_audience_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criterion public.evaluation_criteria%rowtype;
  v_event_id uuid;
begin
  select * into v_criterion from public.evaluation_criteria where id = new.criterion_id;
  select event_id into v_event_id from public.audience_submissions where id = new.submission_id;
  if v_criterion.id is null or v_criterion.scope <> 'AUDIENCE' or v_criterion.event_id <> v_event_id then
    raise exception 'INVALID_CRITERION';
  end if;
  if new.score < 0 or new.score > v_criterion.max_score then
    raise exception 'SCORE_OUT_OF_RANGE';
  end if;
  return new;
end;
$$;

create function public.validate_judge_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criterion public.evaluation_criteria%rowtype;
  v_event_id uuid;
  v_status public.submission_status;
begin
  select * into v_criterion from public.evaluation_criteria where id = new.criterion_id;
  select event_id, status into v_event_id, v_status from public.judge_submissions where id = new.submission_id;
  if v_status <> 'DRAFT' then
    raise exception 'FINAL_SUBMISSION_READ_ONLY';
  end if;
  if v_criterion.id is null or v_criterion.scope <> 'JUDGE' or v_criterion.event_id <> v_event_id then
    raise exception 'INVALID_CRITERION';
  end if;
  if new.score < 0 or new.score > v_criterion.max_score then
    raise exception 'SCORE_OUT_OF_RANGE';
  end if;
  return new;
end;
$$;

create trigger audience_scores_validate
before insert or update on public.audience_scores
for each row execute function public.validate_audience_score();

create trigger judge_scores_validate
before insert or update on public.judge_scores
for each row execute function public.validate_judge_score();

create function public.prevent_submitted_judge_changes()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'SUBMITTED' and public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'FINAL_SUBMISSION_READ_ONLY';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger judge_submission_read_only
before update or delete on public.judge_submissions
for each row execute function public.prevent_submitted_judge_changes();

create function public.set_event_voting_status(
  p_event_id uuid,
  p_status public.voting_status
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then
    raise exception 'FORBIDDEN';
  end if;
  update public.events
  set voting_status = p_status,
      status = case
        when p_status = 'READY' then 'VOTING_READY'::public.event_status
        when p_status = 'OPEN' then 'VOTING_OPEN'::public.event_status
        else 'VOTING_CLOSED'::public.event_status
      end
  where id = p_event_id
  returning * into v_event;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_event_id,
    auth.uid(),
    case
      when p_status = 'OPEN' then 'VOTING_OPEN'
      when p_status = 'CLOSED' then 'VOTING_CLOSE'
      else 'VOTING_READY'
    end,
    'event',
    p_event_id,
    jsonb_build_object('voting_status', p_status)
  );
  return v_event;
end;
$$;

revoke all on function public.set_event_voting_status(uuid, public.voting_status) from public;
grant execute on function public.set_event_voting_status(uuid, public.voting_status) to authenticated;

create function public.set_event_mode(p_event_id uuid, p_mode public.event_mode)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_previous_mode public.event_mode;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'FORBIDDEN';
  end if;
  select mode into v_previous_mode from public.events where id = p_event_id for update;
  if v_previous_mode is null then raise exception 'EVENT_NOT_FOUND'; end if;
  update public.events set mode = p_mode where id = p_event_id returning * into v_event;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'MODE_CHANGE', 'event', p_event_id,
    jsonb_build_object('from', v_previous_mode, 'to', p_mode));
  return v_event;
end;
$$;

revoke all on function public.set_event_mode(uuid, public.event_mode) from public;
grant execute on function public.set_event_mode(uuid, public.event_mode) to authenticated;

create function public.set_event_status(p_event_id uuid, p_status public.event_status)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_previous_status public.event_status;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then
    raise exception 'FORBIDDEN';
  end if;
  select status into v_previous_status from public.events where id = p_event_id for update;
  if v_previous_status is null then raise exception 'EVENT_NOT_FOUND'; end if;
  update public.events
  set status = p_status,
      voting_status = case
        when p_status = 'VOTING_READY' then 'READY'::public.voting_status
        when p_status = 'VOTING_OPEN' then 'OPEN'::public.voting_status
        when p_status = 'VOTING_CLOSED' then 'CLOSED'::public.voting_status
        else voting_status
      end
  where id = p_event_id
  returning * into v_event;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'EVENT_STATUS_CHANGE', 'event', p_event_id,
    jsonb_build_object('from', v_previous_status, 'to', p_status));
  return v_event;
end;
$$;

revoke all on function public.set_event_status(uuid, public.event_status) from public;
grant execute on function public.set_event_status(uuid, public.event_status) to authenticated;

create function public.draw_prize_winner(p_event_id uuid)
returns table (draw_id uuid, round integer, participant_id uuid, participant_code text, drawn_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.participants%rowtype;
  v_draw public.prize_draws%rowtype;
  v_round integer;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then
    raise exception 'FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  select participant.* into v_participant
  from public.participants participant
  join public.check_ins check_in
    on check_in.event_id = participant.event_id and check_in.participant_id = participant.id
  where participant.event_id = p_event_id
    and participant.active = true
    and not exists (
      select 1 from public.prize_draws previous
      where previous.event_id = p_event_id
        and previous.participant_id = participant.id
        and previous.status = 'ACTIVE'
    )
  order by gen_random_uuid()
  limit 1
  for update of participant;

  if v_participant.id is null then raise exception 'NO_ELIGIBLE_PARTICIPANT'; end if;
  select coalesce(max(prize_draws.round), 0) + 1 into v_round
  from public.prize_draws where event_id = p_event_id;

  insert into public.prize_draws (event_id, round, participant_id, drawn_by)
  values (p_event_id, v_round, v_participant.id, auth.uid())
  returning * into v_draw;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'PRIZE_DRAW', 'prize_draw', v_draw.id,
    jsonb_build_object('participant_id', v_participant.id, 'round', v_round));

  return query select v_draw.id, v_draw.round, v_participant.id,
    v_participant.participant_code, v_draw.drawn_at;
end;
$$;

revoke all on function public.draw_prize_winner(uuid) from public;
grant execute on function public.draw_prize_winner(uuid) to authenticated;

create function public.reset_rehearsal_event(p_event_id uuid)
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
  delete from public.audience_submissions where event_id = p_event_id;
  delete from public.judge_submissions where event_id = p_event_id;
  delete from public.check_ins where event_id = p_event_id;
  delete from public.audit_logs where event_id = p_event_id;
  update public.events set status = 'SETUP', voting_status = 'READY' where id = p_event_id;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id)
  values (p_event_id, auth.uid(), 'REHEARSAL_RESET', 'event', p_event_id);
end;
$$;

revoke all on function public.reset_rehearsal_event(uuid) from public;
grant execute on function public.reset_rehearsal_event(uuid) to authenticated;

revoke all on function public.validate_audience_score() from public;
revoke all on function public.validate_judge_score() from public;
revoke all on function public.prevent_submitted_judge_changes() from public;
