begin;

create table public.part_attendance_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete restrict,
  part smallint not null check (part in (1, 2)),
  department text not null check (length(trim(department)) between 2 and 80),
  student_number text not null check (length(trim(student_number)) between 5 and 20),
  attendee_name text not null check (length(trim(attendee_name)) between 2 and 30),
  submitted_at timestamptz not null default now(),
  unique (event_id, student_number, part)
);
alter table public.part_attendance_entries enable row level security;
revoke all on public.part_attendance_entries from public, anon, authenticated;

create or replace function public.submit_part_attendance(
  p_event_id uuid, p_part smallint, p_department text, p_student_number text, p_name text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare normalized_student text := upper(trim(p_student_number));
  normalized_name text := trim(p_name);
  normalized_department text := trim(p_department);
  code text;
  selected_participant public.participants%rowtype;
  saved public.part_attendance_entries%rowtype;
  was_duplicate boolean := false;
begin
  if p_part not in (1, 2) or normalized_student !~ '^[0-9A-Z-]{5,20}$'
    or length(normalized_name) not between 2 and 30 or length(normalized_department) not between 2 and 80 then
    raise exception 'ATTENDANCE_INVALID_INPUT';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then raise exception 'EVENT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':PART_ATTENDANCE:' || normalized_student, 0));
  if exists (
    select 1 from public.part_attendance_entries entry
    where entry.event_id = p_event_id and entry.student_number = normalized_student
      and (entry.attendee_name <> normalized_name or entry.department <> normalized_department)
  ) then raise exception 'ATTENDANCE_IDENTITY_MISMATCH'; end if;
  code := 'ENT-' || upper(substr(encode(extensions.digest(normalized_student, 'sha256'), 'hex'), 1, 8));
  insert into public.participants (event_id, participant_code, display_label, affiliation, active)
  values (p_event_id, code, code, normalized_department, true)
  on conflict (event_id, participant_code) do update set affiliation = excluded.affiliation, active = true
  returning * into selected_participant;
  select * into saved from public.part_attendance_entries
    where event_id = p_event_id and student_number = normalized_student and part = p_part;
  if saved.id is null then
    insert into public.part_attendance_entries (event_id, participant_id, part, department, student_number, attendee_name)
    values (p_event_id, selected_participant.id, p_part, normalized_department, normalized_student, normalized_name)
    returning * into saved;
  else was_duplicate := true;
  end if;
  return jsonb_build_object('id', saved.id, 'participant_code', code, 'part', saved.part,
    'department', saved.department, 'submitted_at', saved.submitted_at, 'duplicate', was_duplicate);
end;
$$;
revoke all on function public.submit_part_attendance(uuid, smallint, text, text, text) from public;
grant execute on function public.submit_part_attendance(uuid, smallint, text, text, text) to anon, authenticated;

create or replace function public.get_part_attendance_snapshot(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with counts as (
    select count(distinct student_number) filter (where part = 1) as part_one_count,
      count(distinct student_number) filter (where part = 2) as part_two_count,
      count(distinct student_number) as unique_count
    from public.part_attendance_entries where event_id = p_event_id
  ), both_parts as (
    select count(*) as both_count from (
      select student_number from public.part_attendance_entries where event_id = p_event_id
      group by student_number having count(distinct part) = 2
    ) matched
  ), latest_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('part', part, 'department', department,
      'participant_code', participant_code, 'submitted_at', submitted_at) order by submitted_at desc), '[]'::jsonb) latest
    from (
      select entry.part, entry.department, participant.participant_code, entry.submitted_at
      from public.part_attendance_entries entry join public.participants participant on participant.id = entry.participant_id
      where entry.event_id = p_event_id order by entry.submitted_at desc limit 10
    ) recent
  )
  select jsonb_build_object('part_one_count', counts.part_one_count, 'part_two_count', counts.part_two_count,
    'both_count', both_parts.both_count, 'unique_count', counts.unique_count, 'latest', latest_rows.latest)
  from counts cross join both_parts cross join latest_rows;
$$;
revoke all on function public.get_part_attendance_snapshot(uuid) from public;
grant execute on function public.get_part_attendance_snapshot(uuid) to anon, authenticated;

alter table public.prize_inventory add column if not exists draw_stage public.prize_draw_stage;
alter table public.prize_inventory add column if not exists award_only boolean not null default false;
update public.prize_inventory set display_order = display_order + 100
where event_id = '00000000-0000-4000-8000-000000000100';

update public.prize_inventory set display_order = 1, name = '베스트 리뷰어상 · 아웃백 상품권',
  unit_amount = 80000, quantity = 2, winner_count = 2, draw_stage = null, award_only = true
where event_id = '00000000-0000-4000-8000-000000000100' and pool = 'AUDIENCE_JURY' and name like '아웃백%';
update public.prize_inventory set status = 'UNCONFIRMED', award_only = true, draw_stage = null
where event_id = '00000000-0000-4000-8000-000000000100' and pool = 'AUDIENCE_JURY' and name = '커피 쿠폰';
update public.prize_inventory set display_order = 1, name = '커피 쿠폰', unit_amount = 10000,
  quantity = 15, winner_count = 15, draw_stage = 'FIRST', award_only = false
where event_id = '00000000-0000-4000-8000-000000000100' and pool = 'ALL_PARTICIPANTS' and name = '커피 쿠폰';
update public.prize_inventory set display_order = 2, name = '올리브영 상품권 2만원', draw_stage = 'SECOND', award_only = false
where event_id = '00000000-0000-4000-8000-000000000100' and pool = 'ALL_PARTICIPANTS' and unit_amount = 20000;
update public.prize_inventory set display_order = 3, name = '올리브영 상품권 3만원', draw_stage = 'THIRD', award_only = false
where event_id = '00000000-0000-4000-8000-000000000100' and pool = 'ALL_PARTICIPANTS' and unit_amount = 30000;
update public.prize_inventory set display_order = 4, name = '에어팟', draw_stage = 'THIRD', award_only = false
where event_id = '00000000-0000-4000-8000-000000000100' and pool = 'ALL_PARTICIPANTS' and name = '에어팟';
insert into public.prize_inventory (event_id, pool, display_order, name, unit_amount, quantity, winner_count, draw_stage, award_only)
values ('00000000-0000-4000-8000-000000000100', 'ALL_PARTICIPANTS', 5, '커피 쿠폰', 10000, 5, 5, 'THIRD', false)
on conflict (event_id, pool, display_order) do update set name = excluded.name, unit_amount = excluded.unit_amount,
  quantity = excluded.quantity, winner_count = excluded.winner_count, draw_stage = excluded.draw_stage, award_only = false;

create or replace function public.lock_prize_stage_eligibility(p_event_id uuid, p_stage public.prize_draw_stage)
returns public.prize_stage_snapshots language plpgsql security definer set search_path = public as $$
declare saved public.prize_stage_snapshots%rowtype; member_count integer; selected_part smallint;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  selected_part := case when p_stage = 'FIRST' then 1 else 2 end;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':PRIZE_STAGE:' || p_stage::text, 0));
  select * into saved from public.prize_stage_snapshots where event_id = p_event_id and stage = p_stage;
  if saved.id is not null then return saved; end if;
  if not exists (select 1 from public.events where id = p_event_id) then raise exception 'EVENT_NOT_FOUND'; end if;
  insert into public.prize_stage_snapshots (event_id, stage, eligible_count, locked_by)
  values (p_event_id, p_stage, 1, auth.uid()) returning * into saved;
  insert into public.prize_stage_eligible_participants (snapshot_id, participant_id)
  select saved.id, entry.participant_id from public.part_attendance_entries entry
  where entry.event_id = p_event_id and entry.part = selected_part group by entry.participant_id;
  select count(*) into member_count from public.prize_stage_eligible_participants member where member.snapshot_id = saved.id;
  if member_count = 0 then raise exception 'NO_ELIGIBLE_PARTICIPANT'; end if;
  update public.prize_stage_snapshots set eligible_count = member_count where id = saved.id returning * into saved;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'PRIZE_STAGE_ELIGIBILITY_LOCK', 'prize_stage_snapshot', saved.id,
    jsonb_build_object('stage', p_stage, 'attendance_part', selected_part, 'eligible_count', saved.eligible_count));
  return saved;
end;
$$;

create or replace function public.draw_prize_item_winner_for_stage(p_event_id uuid, p_prize_item_id uuid, p_stage public.prize_draw_stage)
returns table (draw_id uuid, prize_item_id uuid, prize_name text, pool public.prize_eligibility_pool, round integer, participant_code text, drawn_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare selected_prize public.prize_inventory%rowtype; selected_participant public.participants%rowtype;
  selected_snapshot public.prize_stage_snapshots%rowtype; saved public.prize_item_draws%rowtype; next_round integer;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || p_prize_item_id::text || ':' || p_stage::text, 0));
  select * into selected_snapshot from public.prize_stage_snapshots where event_id = p_event_id and stage = p_stage;
  if selected_snapshot.id is null then raise exception 'PRIZE_STAGE_NOT_LOCKED'; end if;
  select * into selected_prize from public.prize_inventory where id = p_prize_item_id and event_id = p_event_id and status = 'CONFIRMED' for update;
  if selected_prize.id is null then raise exception 'PRIZE_NOT_FOUND'; end if;
  if selected_prize.award_only or selected_prize.draw_stage is distinct from p_stage then raise exception 'PRIZE_STAGE_MISMATCH'; end if;
  select coalesce(max(item_draw.round), 0) + 1 into next_round from public.prize_item_draws item_draw where item_draw.prize_item_id = selected_prize.id;
  if next_round > selected_prize.winner_count then raise exception 'PRIZE_DRAW_COMPLETED'; end if;
  select participant.* into selected_participant from public.prize_stage_eligible_participants eligible
  join public.participants participant on participant.id = eligible.participant_id
  where eligible.snapshot_id = selected_snapshot.id and participant.event_id = p_event_id and participant.active
    and not exists (select 1 from public.prize_item_draws previous where previous.event_id = p_event_id and previous.participant_id = participant.id and previous.status = 'ACTIVE')
  order by gen_random_uuid() limit 1 for update of participant;
  if selected_participant.id is null then raise exception 'NO_ELIGIBLE_PARTICIPANT'; end if;
  insert into public.prize_item_draws (event_id, prize_item_id, round, participant_id, drawn_by)
  values (p_event_id, selected_prize.id, next_round, selected_participant.id, auth.uid()) returning * into saved;
  update public.prize_inventory set draw_status = case when next_round = selected_prize.winner_count then 'COMPLETED'::public.prize_catalog_draw_status else 'IN_PROGRESS'::public.prize_catalog_draw_status end where id = selected_prize.id;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'PRIZE_STAGE_DRAW', 'prize_item_draw', saved.id, jsonb_build_object('stage', p_stage, 'snapshot_id', selected_snapshot.id, 'prize_item_id', selected_prize.id, 'participant_id', selected_participant.id, 'round', next_round));
  return query select saved.id, selected_prize.id, selected_prize.name, selected_prize.pool, saved.round, selected_participant.participant_code, saved.drawn_at;
end;
$$;

alter table public.ceremony_control_states drop constraint if exists ceremony_control_states_phase_check;
alter table public.ceremony_control_states add constraint ceremony_control_states_phase_check
  check (phase in ('FIRST_DRAW','AUDIENCE_CANDIDATES','SECOND_DRAW','JUDGE_REVIEW','RESULTS','BEST_REVIEWER','THIRD_DRAW','COMPLETE'));
create or replace function public.advance_ceremony_phase(p_event_id uuid, p_phase text)
returns public.ceremony_control_states language plpgsql security definer set search_path = public as $$
declare saved public.ceremony_control_states%rowtype; current_index integer; next_index integer;
  phases text[] := array['FIRST_DRAW','AUDIENCE_CANDIDATES','SECOND_DRAW','JUDGE_REVIEW','RESULTS','BEST_REVIEWER','THIRD_DRAW','COMPLETE'];
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  next_index := array_position(phases, p_phase); if next_index is null then raise exception 'CEREMONY_INVALID_PHASE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':CEREMONY', 0));
  select * into saved from public.ceremony_control_states where event_id = p_event_id for update;
  if saved.event_id is null then
    if p_phase <> 'FIRST_DRAW' then raise exception 'CEREMONY_INVALID_TRANSITION'; end if;
    insert into public.ceremony_control_states (event_id, phase, updated_by) values (p_event_id, p_phase, auth.uid()) returning * into saved;
  else
    current_index := array_position(phases, saved.phase);
    if next_index < current_index or next_index > current_index + 1 then raise exception 'CEREMONY_INVALID_TRANSITION'; end if;
    update public.ceremony_control_states set phase = p_phase, updated_by = auth.uid(), updated_at = now() where event_id = p_event_id returning * into saved;
  end if;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'CEREMONY_PHASE_CHANGE', 'event', p_event_id, jsonb_build_object('phase', p_phase));
  return saved;
end;
$$;

commit;
