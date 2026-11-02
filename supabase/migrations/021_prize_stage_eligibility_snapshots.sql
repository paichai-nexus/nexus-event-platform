begin;
create type public.prize_draw_stage as enum ('SECOND', 'THIRD');
create table public.prize_stage_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  stage public.prize_draw_stage not null,
  eligible_count integer not null check (eligible_count > 0),
  locked_by uuid not null references auth.users(id) on delete restrict,
  locked_at timestamptz not null default now(),
  unique (event_id, stage)
);
create table public.prize_stage_eligible_participants (
  snapshot_id uuid not null references public.prize_stage_snapshots(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete restrict,
  primary key (snapshot_id, participant_id)
);
alter table public.prize_stage_snapshots enable row level security;
alter table public.prize_stage_eligible_participants enable row level security;
create policy prize_stage_snapshots_staff_read on public.prize_stage_snapshots for select to authenticated using (public.current_app_role() in ('ADMIN', 'STAFF'));
create policy prize_stage_members_staff_read on public.prize_stage_eligible_participants for select to authenticated using (public.current_app_role() in ('ADMIN', 'STAFF'));

create function public.lock_prize_stage_eligibility(p_event_id uuid, p_stage public.prize_draw_stage)
returns public.prize_stage_snapshots language plpgsql security definer set search_path = public as $$
declare saved public.prize_stage_snapshots%rowtype;
  member_count integer;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':PRIZE_STAGE:' || p_stage::text, 0));
  select * into saved from public.prize_stage_snapshots where event_id = p_event_id and stage = p_stage;
  if saved.id is not null then return saved; end if;
  if not exists (select 1 from public.events where id = p_event_id) then raise exception 'EVENT_NOT_FOUND'; end if;
  insert into public.prize_stage_snapshots (event_id, stage, eligible_count, locked_by)
  values (p_event_id, p_stage, 1, auth.uid()) returning * into saved;
  insert into public.prize_stage_eligible_participants (snapshot_id, participant_id)
  select saved.id, candidate.participant_id from (
    select check_in.participant_id from public.check_ins check_in where check_in.event_id = p_event_id
    union
    select attendance.participant_id from public.audience_attendance_sessions attendance where attendance.event_id = p_event_id and attendance.exited_at is null
  ) candidate;
  select count(*) into member_count from public.prize_stage_eligible_participants member where member.snapshot_id = saved.id;
  if member_count = 0 then raise exception 'NO_ELIGIBLE_PARTICIPANT'; end if;
  update public.prize_stage_snapshots snapshot set eligible_count = member_count where snapshot.id = saved.id returning * into saved;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'PRIZE_STAGE_ELIGIBILITY_LOCK', 'prize_stage_snapshot', saved.id,
    jsonb_build_object('stage', p_stage, 'eligible_count', saved.eligible_count));
  return saved;
end;
$$;

create function public.draw_prize_item_winner_for_stage(p_event_id uuid, p_prize_item_id uuid, p_stage public.prize_draw_stage)
returns table (draw_id uuid, prize_item_id uuid, prize_name text, pool public.prize_eligibility_pool, round integer, participant_code text, drawn_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_prize public.prize_inventory%rowtype;
  selected_participant public.participants%rowtype;
  selected_snapshot public.prize_stage_snapshots%rowtype;
  saved public.prize_item_draws%rowtype;
  next_round integer;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || p_prize_item_id::text || ':' || p_stage::text, 0));
  select * into selected_snapshot from public.prize_stage_snapshots where event_id = p_event_id and stage = p_stage;
  if selected_snapshot.id is null then raise exception 'PRIZE_STAGE_NOT_LOCKED'; end if;
  select * into selected_prize from public.prize_inventory where id = p_prize_item_id and event_id = p_event_id and status = 'CONFIRMED' for update;
  if selected_prize.id is null then raise exception 'PRIZE_NOT_FOUND'; end if;
  select coalesce(max(item_draw.round), 0) + 1 into next_round from public.prize_item_draws item_draw where item_draw.prize_item_id = selected_prize.id;
  if next_round > selected_prize.winner_count then raise exception 'PRIZE_DRAW_COMPLETED'; end if;
  select participant.* into selected_participant
  from public.prize_stage_eligible_participants eligible
  join public.participants participant on participant.id = eligible.participant_id
  where eligible.snapshot_id = selected_snapshot.id and participant.event_id = p_event_id and participant.active
    and (selected_prize.pool = 'ALL_PARTICIPANTS' or exists (
      select 1 from public.audience_jury_reservations jury where jury.event_id = p_event_id
        and jury.pcu_code = participant.participant_code and jury.qr_checked_in_at is not null
    ))
    and not exists (select 1 from public.prize_item_draws previous where previous.event_id = p_event_id and previous.participant_id = participant.id and previous.status = 'ACTIVE')
  order by gen_random_uuid() limit 1 for update of participant;
  if selected_participant.id is null then raise exception 'NO_ELIGIBLE_PARTICIPANT'; end if;
  insert into public.prize_item_draws (event_id, prize_item_id, round, participant_id, drawn_by)
  values (p_event_id, selected_prize.id, next_round, selected_participant.id, auth.uid()) returning * into saved;
  update public.prize_inventory set draw_status = case when next_round = selected_prize.winner_count then 'COMPLETED'::public.prize_catalog_draw_status else 'IN_PROGRESS'::public.prize_catalog_draw_status end where id = selected_prize.id;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'PRIZE_STAGE_DRAW', 'prize_item_draw', saved.id,
    jsonb_build_object('stage', p_stage, 'snapshot_id', selected_snapshot.id, 'prize_item_id', selected_prize.id, 'participant_id', selected_participant.id, 'round', next_round));
  return query select saved.id, selected_prize.id, selected_prize.name, selected_prize.pool, saved.round, selected_participant.participant_code, saved.drawn_at;
end;
$$;
revoke all on public.prize_stage_snapshots, public.prize_stage_eligible_participants from anon, authenticated;
grant select on public.prize_stage_snapshots, public.prize_stage_eligible_participants to authenticated;
revoke all on function public.lock_prize_stage_eligibility(uuid, public.prize_draw_stage) from public;
grant execute on function public.lock_prize_stage_eligibility(uuid, public.prize_draw_stage) to authenticated;
revoke all on function public.draw_prize_item_winner_for_stage(uuid, uuid, public.prize_draw_stage) from public;
grant execute on function public.draw_prize_item_winner_for_stage(uuid, uuid, public.prize_draw_stage) to authenticated;
commit;
