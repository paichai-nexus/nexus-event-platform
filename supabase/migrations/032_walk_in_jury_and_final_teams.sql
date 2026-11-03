begin;

-- The event-day paper serials use PCU-101 through PCU-220. Do not silently
-- rewrite previously issued identifiers: a populated installation requires a
-- separately reviewed, audited remapping before this migration can proceed.
do $$
begin
  if exists (
    select 1 from public.audience_jury_reservations where pcu_code is not null
  ) then
    raise exception 'PCU_CODE_RANGE_MIGRATION_REVIEW_REQUIRED';
  end if;
end;
$$;

alter table public.audience_jury_reservations
  drop constraint audience_jury_pcu_check;

alter table public.audience_jury_reservations
  add constraint audience_jury_pcu_check check (
    pcu_code is null or
    (pcu_code ~ '^PCU-[0-9]{3}$' and (
      (department = '경영학과' and pcu_code between 'PCU-101' and 'PCU-120') or
      (department = 'IT경영정보학과' and pcu_code between 'PCU-121' and 'PCU-140') or
      (department = '관광경영학과' and pcu_code between 'PCU-141' and 'PCU-160') or
      (department = '항공서비스학과' and pcu_code between 'PCU-161' and 'PCU-180') or
      (department = '글로벌비즈니스학과' and pcu_code between 'PCU-181' and 'PCU-200') or
      (department = '호텔항공경영학과' and pcu_code between 'PCU-201' and 'PCU-220')
    ))
  );

-- A first-part attendance submission is also the event-day walk-in queue for
-- the audience jury. Department advisory locks make the 20-person limit and
-- PCU allocation atomic even when many mobile requests arrive together.
create or replace function public.submit_part_attendance(
  p_event_id uuid, p_part smallint, p_department text, p_student_number text, p_name text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  normalized_student text := upper(trim(p_student_number));
  normalized_name text := trim(p_name);
  normalized_department text := trim(p_department);
  code text;
  selected_participant public.participants%rowtype;
  saved public.part_attendance_entries%rowtype;
  selected_reservation public.audience_jury_reservations%rowtype;
  was_duplicate boolean := false;
  department_start integer;
  available_code_number integer;
  jury_code text;
  jury_capacity_reached boolean := false;
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
  else
    was_duplicate := true;
  end if;

  if p_part = 1 then
    perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':AUDIENCE_JURY:' || normalized_department, 0));

    select * into selected_reservation from public.audience_jury_reservations reservation
    where reservation.event_id = p_event_id and reservation.student_number = normalized_student
    for update;

    if selected_reservation.id is not null and
      (selected_reservation.attendee_name <> normalized_name or selected_reservation.department <> normalized_department) then
      raise exception 'ATTENDANCE_IDENTITY_MISMATCH';
    end if;

    if selected_reservation.id is null then
      insert into public.audience_jury_reservations (
        event_id, department, student_number, attendee_name, paper_signed_at, qr_checked_in_at
      ) values (
        p_event_id, normalized_department, normalized_student, normalized_name, now(), now()
      ) returning * into selected_reservation;
    else
      update public.audience_jury_reservations
      set paper_signed_at = coalesce(paper_signed_at, now()), qr_checked_in_at = coalesce(qr_checked_in_at, now())
      where id = selected_reservation.id returning * into selected_reservation;
    end if;

    if selected_reservation.pcu_code is null then
      department_start := case normalized_department
        when '경영학과' then 101
        when 'IT경영정보학과' then 121
        when '관광경영학과' then 141
        when '항공서비스학과' then 161
        when '글로벌비즈니스학과' then 181
        when '호텔항공경영학과' then 201
        else null end;
      if department_start is null then raise exception 'INVALID_DEPARTMENT'; end if;

      select candidate into available_code_number
      from generate_series(department_start, department_start + 19) candidate
      where not exists (
        select 1 from public.audience_jury_reservations reservation
        where reservation.event_id = p_event_id
          and reservation.pcu_code = 'PCU-' || lpad(candidate::text, 3, '0')
      )
      order by candidate limit 1;

      if available_code_number is null then
        jury_capacity_reached := true;
      else
        jury_code := 'PCU-' || lpad(available_code_number::text, 3, '0');
        update public.audience_jury_reservations set pcu_code = jury_code
        where id = selected_reservation.id returning * into selected_reservation;
      end if;
    else
      jury_code := selected_reservation.pcu_code;
    end if;
  end if;

  return jsonb_build_object(
    'id', saved.id, 'participant_code', code, 'part', saved.part,
    'department', saved.department, 'submitted_at', saved.submitted_at, 'duplicate', was_duplicate,
    'jury_serial_number', jury_code, 'jury_capacity_reached', jury_capacity_reached
  );
end;
$$;
revoke all on function public.submit_part_attendance(uuid, smallint, text, text, text) from public;
grant execute on function public.submit_part_attendance(uuid, smallint, text, text, text) to anon, authenticated;

-- A PCU code may already have been issued by first-part attendance. Entering
-- the same identity on /vote binds that existing code to the current browser.
create or replace function public.register_audience_jury(
  p_event_id uuid, p_session_token text, p_department text, p_name text, p_student_number text
) returns table (registration jsonb, departments jsonb, total_accepted integer, total_capacity integer)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event_id uuid;
  normalized_student_number text;
  token_hash text;
  selected_reservation public.audience_jury_reservations%rowtype;
  department_count integer;
  department_start integer;
begin
  if length(coalesce(p_session_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  normalized_student_number := upper(trim(p_student_number));
  token_hash := encode(digest(p_session_token, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(selected_event_id::text || ':' || p_department, 0));

  select * into selected_reservation from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event_id and reservation.student_number = normalized_student_number
    and reservation.attendee_name = trim(p_name) and reservation.department = p_department for update;
  if selected_reservation.id is null then raise exception 'RESERVATION_MISMATCH'; end if;
  if selected_reservation.paper_signed_at is null then raise exception 'PAPER_SIGNATURE_REQUIRED'; end if;

  if selected_reservation.pcu_code is not null then
    if selected_reservation.session_token_hash is not null and selected_reservation.session_token_hash <> token_hash then
      raise exception 'ALREADY_REGISTERED';
    end if;
    update public.audience_jury_reservations set session_token_hash = token_hash
    where id = selected_reservation.id and session_token_hash is null;
    return query select * from public.get_audience_jury_state(selected_event_id, p_session_token);
    return;
  end if;

  select count(*)::integer into department_count from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event_id and reservation.department = p_department and reservation.pcu_code is not null;
  if department_count >= 20 then raise exception 'DEPARTMENT_CAPACITY_REACHED'; end if;
  department_start := case p_department
    when '경영학과' then 101 when 'IT경영정보학과' then 121 when '관광경영학과' then 141
    when '항공서비스학과' then 161 when '글로벌비즈니스학과' then 181 when '호텔항공경영학과' then 201
    else null end;
  if department_start is null then raise exception 'INVALID_DEPARTMENT'; end if;

  update public.audience_jury_reservations set qr_checked_in_at = coalesce(qr_checked_in_at, now()),
    pcu_code = 'PCU-' || lpad((department_start + department_count)::text, 3, '0'), session_token_hash = token_hash
  where id = selected_reservation.id;
  return query select * from public.get_audience_jury_state(selected_event_id, p_session_token);
end;
$$;
revoke all on function public.register_audience_jury(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_audience_jury(uuid, text, text, text, text) to service_role;

-- Official 12-team final roster. Missing leader/advisor fields intentionally
-- remain null until the organizer provides confirmed names.
with official("order", name, department, category, topic, members, advisor) as (values
  (1, '관광ON', '관광경영학과', 'STARTUP'::public.team_category, '체류형 야간관광 서비스 ''진주 밤 패스'' 사업 제안', '{}'::text[], null::text),
  (2, 'TEA:MATE', '호텔항공경영학과', 'STARTUP'::public.team_category, '고객 맞춤형 티타임 설계 기반 카페·바 및 MICE 연계 서비스', array['김소윤','김민건','성지민','장지한'], '곽용섭, 박근수'),
  (3, '연애하자', '경영학과', 'STARTUP'::public.team_category, '대전 대학생을 위한 취미 활동 기반 로테이션 소개팅 ''밋턴''', array['안성열','최병현','홍경훈'], null::text),
  (4, 'EVER OASIS', '항공서비스학과', 'STARTUP'::public.team_category, '독립형 GPS 비상목걸이 EverOasis', '{}'::text[], null::text),
  (5, '타겟', 'IT경영정보학과', 'STARTUP'::public.team_category, '센서 기반 양궁 트래킹 플랫폼 Release Pro', array['서세은','이미란','임이안'], null::text),
  (6, '김성근', '글로벌비즈니스학과', 'STARTUP'::public.team_category, '홍삼·꿀 프리미엄 그릭요거트 K-웰니스 사업', array['조범근','김동현','홍성빈'], null::text),
  (7, '가치로', '글로벌비즈니스학과', 'BUSINESS_ANALYSIS'::public.team_category, '메가 LCC 시대, 에어부산의 경쟁 전략', array['신예준','김지원','김혜원'], null::text),
  (8, '조선제일주', '경영학과', 'BUSINESS_ANALYSIS'::public.team_category, '재무분석을 통한 선양소주 브랜드 향상 전략', array['전도언','이윤석','장재진','김성혁'], null::text),
  (9, '어프로치', '호텔항공경영학과', 'BUSINESS_ANALYSIS'::public.team_category, '고성장 이후의 APR, 글로벌 뷰티테크 기업의 지속성장 전략', array['표민기','최유현','전현정','최벼리','김태연'], null::text),
  (10, '분석할계룡', '경영학과', 'BUSINESS_ANALYSIS'::public.team_category, '이익 회복을 넘어 현금과 기업가치의 지속가능성을 분석한 계룡건설산업 보고서', array['소명','한예지','성현경','이현승'], null::text),
  (11, '시너지', 'IT경영정보학과', 'BUSINESS_ANALYSIS'::public.team_category, '광통신 성장과 성호전자의 투자 가치', '{}'::text[], null::text),
  (12, 'TOUCHPOINT', '항공서비스학과', 'BUSINESS_ANALYSIS'::public.team_category, '항공산업 기업분석에 따른 객실승무원 취업 전략', '{}'::text[], null::text)
)
update public.teams team set name = official.name, department = official.department, category = official.category,
  presentation_topic = official.topic, member_names = official.members, advisor_name = official.advisor,
  leader_name = null, promotion_enabled = true, status = 'WAITING'::public.team_status, active = true
from official where team.event_id = '00000000-0000-4000-8000-000000000100' and team.presentation_order = official."order";

update public.events event set active_team_id = null
where event.id = '00000000-0000-4000-8000-000000000100' and exists (
  select 1 from public.teams team where team.id = event.active_team_id and team.presentation_order > 12
);
update public.teams set active = false, name = null, promotion_enabled = false
where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order > 12;

create or replace function public.import_team_roster(p_event_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare selected_event public.events%rowtype; row_count integer; startup_count integer; analysis_count integer;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) <> 12 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  select * into selected_event from public.events where id = p_event_id for update;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.status::text in ('FINALIZED', 'ENDED') then raise exception 'EVENT_CLOSED'; end if;
  if (select count(*) from public.teams where event_id = p_event_id and active) <> 12 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  select count(*), count(*) filter (where category = 'STARTUP'), count(*) filter (where category = 'BUSINESS_ANALYSIS')
    into row_count, startup_count, analysis_count
  from jsonb_to_recordset(p_rows) as row_data("order" integer, category text, name text, department text, "leaderName" text, "memberNames" jsonb, "advisorName" text, topic text, active boolean);
  if row_count <> 12 or startup_count <> 6 or analysis_count <> 6 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  if (select count(distinct (item->>'order')::integer) from jsonb_array_elements(p_rows) item) <> 12
    or (select count(distinct lower(trim(item->>'name'))) from jsonb_array_elements(p_rows) item) <> 12 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) item where (item->>'order')::integer not between 1 and 12
    or length(trim(coalesce(item->>'name',''))) = 0 or length(trim(coalesce(item->>'department',''))) = 0
    or length(trim(coalesce(item->>'leaderName',''))) = 0 or length(trim(coalesce(item->>'advisorName',''))) = 0
    or length(trim(coalesce(item->>'topic',''))) = 0 or jsonb_typeof(item->'memberNames') <> 'array' or jsonb_array_length(item->'memberNames') = 0) then raise exception 'TEAM_ROSTER_INVALID'; end if;
  update public.teams team set name = source.name, department = source.department, leader_name = source."leaderName",
    member_names = array(select jsonb_array_elements_text(source."memberNames")), advisor_name = source."advisorName",
    presentation_topic = source.topic, category = source.category::public.team_category, active = source.active,
    promotion_enabled = true, status = 'WAITING'::public.team_status
  from jsonb_to_recordset(p_rows) as source("order" integer, category text, name text, department text, "leaderName" text, "memberNames" jsonb, "advisorName" text, topic text, active boolean)
  where team.event_id = p_event_id and team.presentation_order = source."order" and team.presentation_order between 1 and 12;
  if not found then raise exception 'TEAM_ROSTER_INVALID'; end if;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'TEAM_ROSTER_IMPORT', 'event', p_event_id, jsonb_build_object('team_count', 12, 'startup_count', 6, 'analysis_count', 6));
end;
$$;
revoke all on function public.import_team_roster(uuid, jsonb) from public;
grant execute on function public.import_team_roster(uuid, jsonb) to authenticated;

commit;
