-- Audience jury reservation, paper-signature and department quota control.
-- This migration does not seed or modify production attendee data.

create table public.audience_jury_reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  department text not null,
  student_number text not null,
  attendee_name text not null,
  reserved_at timestamptz not null default now(),
  paper_signed_at timestamptz,
  qr_checked_in_at timestamptz,
  pcu_code text,
  session_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, student_number),
  unique (event_id, pcu_code),
  unique (event_id, session_token_hash),
  constraint audience_jury_department_check check (department in (
    '경영학과', 'IT경영정보학과', '호텔항공경영학과',
    '관광경영학과', '항공서비스학과', '글로벌비즈니스학과'
  )),
  constraint audience_jury_student_number_check check (student_number ~ '^[0-9A-Z-]{5,20}$'),
  constraint audience_jury_name_check check (length(trim(attendee_name)) between 2 and 30),
  constraint audience_jury_pcu_check check (
    pcu_code is null or
    (pcu_code ~ '^PCU[1-6][0-9]{2}$' and (
      (department = '경영학과' and pcu_code between 'PCU101' and 'PCU120') or
      (department = 'IT경영정보학과' and pcu_code between 'PCU201' and 'PCU220') or
      (department = '호텔항공경영학과' and pcu_code between 'PCU301' and 'PCU320') or
      (department = '관광경영학과' and pcu_code between 'PCU401' and 'PCU420') or
      (department = '항공서비스학과' and pcu_code between 'PCU501' and 'PCU520') or
      (department = '글로벌비즈니스학과' and pcu_code between 'PCU601' and 'PCU620')
    ))
  ),
  constraint audience_jury_qr_requires_signature check (qr_checked_in_at is null or paper_signed_at is not null),
  constraint audience_jury_pcu_requires_qr check (pcu_code is null or qr_checked_in_at is not null)
);

create index audience_jury_event_department_idx
  on public.audience_jury_reservations (event_id, department, reserved_at, id);

create trigger audience_jury_reservations_set_updated_at
before update on public.audience_jury_reservations
for each row execute function public.set_updated_at();

alter table public.audience_jury_reservations enable row level security;

create policy audience_jury_staff_read on public.audience_jury_reservations
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy audience_jury_staff_insert on public.audience_jury_reservations
for insert to authenticated
with check (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy audience_jury_staff_update on public.audience_jury_reservations
for update to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'))
with check (public.current_app_role() in ('ADMIN', 'STAFF'));

revoke all on public.audience_jury_reservations from anon;
revoke all on public.audience_jury_reservations from authenticated;
grant select, insert, update on public.audience_jury_reservations to authenticated;

create function public.get_audience_jury_state(p_event_id uuid, p_session_token text)
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
    ('경영학과', 101, 120), ('IT경영정보학과', 201, 220),
    ('호텔항공경영학과', 301, 320), ('관광경영학과', 401, 420),
    ('항공서비스학과', 501, 520), ('글로벌비즈니스학과', 601, 620)
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
      'pcuStart', 'PCU' || range.range_start,
      'pcuEnd', 'PCU' || range.range_end
    ) order by range.range_start) from department_ranges range left join accepted using (department)),
    (select count(*)::integer from public.audience_jury_reservations reservation
      where reservation.event_id = selected_event_id and reservation.pcu_code is not null),
    120;
end;
$$;

create function public.register_audience_jury(
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
    when '경영학과' then 101 when 'IT경영정보학과' then 201
    when '호텔항공경영학과' then 301 when '관광경영학과' then 401
    when '항공서비스학과' then 501 when '글로벌비즈니스학과' then 601
    else null end;
  if department_start is null then raise exception 'INVALID_DEPARTMENT'; end if;

  update public.audience_jury_reservations
  set qr_checked_in_at = coalesce(qr_checked_in_at, now()),
      pcu_code = 'PCU' || (department_start + department_count),
      session_token_hash = token_hash
  where id = selected_reservation.id;

  return query select * from public.get_audience_jury_state(selected_event_id, p_session_token);
end;
$$;

revoke all on function public.get_audience_jury_state(uuid, text) from public;
revoke all on function public.register_audience_jury(uuid, text, text, text, text) from public;
revoke all on function public.get_audience_jury_state(uuid, text) from anon, authenticated;
revoke all on function public.register_audience_jury(uuid, text, text, text, text) from anon, authenticated;
grant execute on function public.get_audience_jury_state(uuid, text) to service_role;
grant execute on function public.register_audience_jury(uuid, text, text, text, text) to service_role;

comment on table public.audience_jury_reservations is
  'Audience jury reservations and event-day paper signature/QR/PCU state. Contains personal data; never expose publicly.';
comment on column public.audience_jury_reservations.session_token_hash is
  'SHA-256 digest only. Plaintext browser session tokens must never be stored.';
