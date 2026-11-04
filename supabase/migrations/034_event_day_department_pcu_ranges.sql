-- 034 - Event-approved six-department PCU range correction.
-- IMPORTANT: LIVE events with issued codes are blocked. In REHEARSAL mode,
-- existing serials are remapped in place; previously printed PCU cards must be reissued.
-- This is transactional and does not remove participants or scores.
BEGIN;

-- Prevent updating already-issued live codes.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audience_jury_reservations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.pcu_code IS NOT NULL AND e.mode::text <> 'REHEARSAL'
  ) THEN RAISE EXCEPTION 'LIVE_ISSUED_PCU_REMAP_FORBIDDEN'; END IF;
END $$;

-- Existing rows can be from 032 (old ranges) or from this migration (new ranges).
CREATE TEMP TABLE _pcu_034_mapping ON COMMIT DROP AS
WITH ranges(department, old_start, new_start) AS (VALUES
    ('경영학과', 101, 101),
    ('IT경영정보학과', 121, 201),
    ('관광경영학과', 141, 401),
    ('항공서비스학과', 161, 501),
    ('글로벌비즈니스학과', 181, 301),
    ('호텔항공경영학과', 201, 601)
)
SELECT r.id, r.event_id, r.pcu_code old_code,
  CASE
    WHEN substring(r.pcu_code from 5)::integer BETWEEN ranges.new_start AND ranges.new_start+19
      THEN r.pcu_code
    WHEN substring(r.pcu_code from 5)::integer BETWEEN ranges.old_start AND ranges.old_start+19
      THEN 'PCU-' || lpad((ranges.new_start + substring(r.pcu_code from 5)::integer - ranges.old_start)::text,3,'0')
    ELSE NULL
  END new_code
FROM public.audience_jury_reservations r
LEFT JOIN ranges ON ranges.department=r.department
WHERE r.pcu_code IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM _pcu_034_mapping WHERE new_code IS NULL) THEN
    RAISE EXCEPTION 'UNRECOGNIZED_OLD_PCU_CODES_REVIEW_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM _pcu_034_mapping GROUP BY event_id,new_code HAVING count(*)>1) THEN
    RAISE EXCEPTION 'PCU_REMAP_COLLISION_REVIEW_REQUIRED';
  END IF;
END $$;

-- Drop OLD range CHECK before changing issued codes; otherwise new values are rejected.
-- The replacement CHECK is installed before COMMIT, so an exception rolls back all changes.
ALTER TABLE public.audience_jury_reservations DROP CONSTRAINT audience_jury_pcu_check;
-- Two-pass remap avoids transient unique-constraint collisions.
UPDATE public.audience_jury_reservations r SET pcu_code=NULL
FROM _pcu_034_mapping m WHERE r.id=m.id AND m.old_code<>m.new_code;
UPDATE public.audience_jury_reservations r SET pcu_code=m.new_code
FROM _pcu_034_mapping m WHERE r.id=m.id AND m.old_code<>m.new_code;

ALTER TABLE public.audience_jury_reservations ADD CONSTRAINT audience_jury_pcu_check CHECK (
  pcu_code IS NULL OR (pcu_code ~ '^PCU-[0-9]{3}$' AND (
      (department = '경영학과' and pcu_code between 'PCU-101' and 'PCU-120')
    or
      (department = 'IT경영정보학과' and pcu_code between 'PCU-201' and 'PCU-220')
    or
      (department = '관광경영학과' and pcu_code between 'PCU-401' and 'PCU-420')
    or
      (department = '항공서비스학과' and pcu_code between 'PCU-501' and 'PCU-520')
    or
      (department = '글로벌비즈니스학과' and pcu_code between 'PCU-301' and 'PCU-320')
    or
      (department = '호텔항공경영학과' and pcu_code between 'PCU-601' and 'PCU-620')
  ))
);

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
        when 'IT경영정보학과' then 201
        when '관광경영학과' then 401
        when '항공서비스학과' then 501
        when '글로벌비즈니스학과' then 301
        when '호텔항공경영학과' then 601
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
REVOKE ALL ON FUNCTION public.submit_part_attendance(uuid, smallint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_part_attendance(uuid, smallint, text, text, text) TO anon, authenticated;

create or replace function public.get_audience_jury_state(p_event_id uuid, p_session_token text)
returns table (registration jsonb, departments jsonb, total_accepted integer, total_capacity integer)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_event_id uuid;
  token_hash text;
begin
  if length(coalesce(p_session_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  return query
  with department_ranges(department, range_start, range_end) as (values
    ('경영학과', 101, 120), ('IT경영정보학과', 201, 220),
    ('관광경영학과', 401, 420), ('항공서비스학과', 501, 520),
    ('글로벌비즈니스학과', 301, 320), ('호텔항공경영학과', 601, 620)
  ), accepted as (
    select reservation.department, count(*)::integer as count
    from public.audience_jury_reservations reservation
    where reservation.event_id = selected_event_id and reservation.pcu_code is not null
    group by reservation.department
  ), own_registration as (
    select reservation.*,
      row_number() over (partition by reservation.department order by reservation.qr_checked_in_at, reservation.id)::integer as position
    from public.audience_jury_reservations reservation
    where reservation.event_id = selected_event_id and reservation.pcu_code is not null
  )
  select
    (select jsonb_build_object(
      'department', own.department, 'name', own.attendee_name,
      'studentNumber', own.student_number, 'serialNumber', own.pcu_code,
      'position', own.position, 'capacity', 20, 'acceptedAt', own.qr_checked_in_at
    ) from own_registration own where own.session_token_hash = token_hash limit 1),
    (select jsonb_agg(jsonb_build_object(
      'department', range.department, 'accepted', coalesce(accepted.count, 0),
      'remaining', 20 - coalesce(accepted.count, 0), 'capacity', 20,
      'pcuStart', 'PCU-' || lpad(range.range_start::text, 3, '0'),
      'pcuEnd', 'PCU-' || lpad(range.range_end::text, 3, '0')
    ) order by range.range_start) from department_ranges range left join accepted using (department)),
    (select count(*)::integer from public.audience_jury_reservations reservation
      where reservation.event_id = selected_event_id and reservation.pcu_code is not null),
    120;
end;
$$;
REVOKE ALL ON FUNCTION public.get_audience_jury_state(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_audience_jury_state(uuid, text) TO service_role;

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
  available_code_number integer;
  department_start integer;
begin
  if length(coalesce(p_session_token, '')) < 16 then raise exception 'INVALID_SESSION'; end if;
  selected_event_id := public.resolve_attendance_event(p_event_id);
  if selected_event_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  normalized_student_number := upper(trim(p_student_number));
  token_hash := encode(digest(p_session_token, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(selected_event_id::text || ':' || p_department, 0));
  perform pg_advisory_xact_lock(hashtextextended(selected_event_id::text || ':AUDIENCE_JURY:' || p_department, 0));

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
    when '경영학과' then 101 when 'IT경영정보학과' then 201 when '관광경영학과' then 401
    when '항공서비스학과' then 501 when '글로벌비즈니스학과' then 301 when '호텔항공경영학과' then 601
    else null end;
  if department_start is null then raise exception 'INVALID_DEPARTMENT'; end if;

  select candidate into available_code_number
  from generate_series(department_start, department_start + 19) candidate
  where not exists (
    select 1 from public.audience_jury_reservations r
    where r.event_id = selected_event_id
      and r.pcu_code = 'PCU-' || lpad(candidate::text, 3, '0')
  ) order by candidate limit 1;
  if available_code_number is null then raise exception 'DEPARTMENT_CAPACITY_REACHED'; end if;
  update public.audience_jury_reservations set qr_checked_in_at = coalesce(qr_checked_in_at, now()),
    pcu_code = 'PCU-' || lpad(available_code_number::text, 3, '0'), session_token_hash = token_hash
  where id = selected_reservation.id;
  return query select * from public.get_audience_jury_state(selected_event_id, p_session_token);
end;
$$;
REVOKE ALL ON FUNCTION public.register_audience_jury(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_audience_jury(uuid, text, text, text, text) TO service_role;
COMMIT;
