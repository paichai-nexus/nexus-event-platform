-- Approved 120-person audience-jury serial layout.
-- Codes are contiguous, unique and split into six non-overlapping groups of 20.

alter table public.audience_jury_reservations
  drop constraint audience_jury_pcu_check;

alter table public.audience_jury_reservations
  add constraint audience_jury_pcu_check check (
    pcu_code is null or
    (pcu_code ~ '^PCU-(00[1-9]|0[1-9][0-9]|1[01][0-9]|120)$' and (
      (department = '경영학과' and pcu_code between 'PCU-001' and 'PCU-020') or
      (department = 'IT경영정보학과' and pcu_code between 'PCU-021' and 'PCU-040') or
      (department = '관광경영학과' and pcu_code between 'PCU-041' and 'PCU-060') or
      (department = '항공서비스학과' and pcu_code between 'PCU-061' and 'PCU-080') or
      (department = '글로벌비즈니스학과' and pcu_code between 'PCU-081' and 'PCU-100') or
      (department = '호텔항공경영학과' and pcu_code between 'PCU-101' and 'PCU-120')
    ))
  );

create or replace function public.get_audience_jury_state(p_event_id uuid, p_session_token text)
returns table (
  registration jsonb,
  departments jsonb,
  total_accepted integer,
  total_capacity integer
)
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
    ('경영학과', 1, 20), ('IT경영정보학과', 21, 40),
    ('관광경영학과', 41, 60), ('항공서비스학과', 61, 80),
    ('글로벌비즈니스학과', 81, 100), ('호텔항공경영학과', 101, 120)
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
      'department', own.department,
      'name', own.attendee_name,
      'studentNumber', own.student_number,
      'serialNumber', own.pcu_code,
      'position', own.position,
      'capacity', 20,
      'acceptedAt', own.qr_checked_in_at
    ) from own_registration own where own.session_token_hash = token_hash limit 1),
    (select jsonb_agg(jsonb_build_object(
      'department', range.department,
      'accepted', coalesce(accepted.count, 0),
      'remaining', 20 - coalesce(accepted.count, 0),
      'capacity', 20,
      'pcuStart', 'PCU-' || lpad(range.range_start::text, 3, '0'),
      'pcuEnd', 'PCU-' || lpad(range.range_end::text, 3, '0')
    ) order by range.range_start) from department_ranges range left join accepted using (department)),
    (select count(*)::integer from public.audience_jury_reservations reservation
      where reservation.event_id = selected_event_id and reservation.pcu_code is not null),
    120;
end;
$$;

create or replace function public.register_audience_jury(
  p_event_id uuid,
  p_session_token text,
  p_department text,
  p_name text,
  p_student_number text
)
returns table (
  registration jsonb,
  departments jsonb,
  total_accepted integer,
  total_capacity integer
)
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

  select * into selected_reservation
  from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event_id
    and reservation.student_number = normalized_student_number
    and reservation.attendee_name = trim(p_name)
    and reservation.department = p_department
  for update;

  if selected_reservation.id is null then raise exception 'RESERVATION_MISMATCH'; end if;
  if selected_reservation.paper_signed_at is null then raise exception 'PAPER_SIGNATURE_REQUIRED'; end if;
  if selected_reservation.pcu_code is not null then
    if selected_reservation.session_token_hash <> token_hash then raise exception 'ALREADY_REGISTERED'; end if;
    return query select * from public.get_audience_jury_state(selected_event_id, p_session_token);
    return;
  end if;

  select count(*)::integer into department_count
  from public.audience_jury_reservations reservation
  where reservation.event_id = selected_event_id
    and reservation.department = p_department
    and reservation.pcu_code is not null;
  if department_count >= 20 then raise exception 'DEPARTMENT_CAPACITY_REACHED'; end if;

  department_start := case p_department
    when '경영학과' then 1
    when 'IT경영정보학과' then 21
    when '관광경영학과' then 41
    when '항공서비스학과' then 61
    when '글로벌비즈니스학과' then 81
    when '호텔항공경영학과' then 101
    else null end;
  if department_start is null then raise exception 'INVALID_DEPARTMENT'; end if;

  update public.audience_jury_reservations
  set qr_checked_in_at = coalesce(qr_checked_in_at, now()),
      pcu_code = 'PCU-' || lpad((department_start + department_count)::text, 3, '0'),
      session_token_hash = token_hash
  where id = selected_reservation.id;

  return query select * from public.get_audience_jury_state(selected_event_id, p_session_token);
end;
$$;

revoke all on function public.get_audience_jury_state(uuid, text) from public, anon, authenticated;
revoke all on function public.register_audience_jury(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_audience_jury_state(uuid, text) to service_role;
grant execute on function public.register_audience_jury(uuid, text, text, text, text) to service_role;
