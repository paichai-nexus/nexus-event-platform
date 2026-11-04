-- 035 - Part 1 is attendance only, Part 2 is attendance plus first-come jury PCU.
-- Apply AFTER 034, and ONLY after rehearsals have been safely reset.
-- No deletes, no alterations to existing participation rows.
BEGIN;
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

  if p_part = 2 then
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
COMMIT;
