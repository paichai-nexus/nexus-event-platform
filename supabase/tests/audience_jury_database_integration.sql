\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION_FAILED: %', message; end if;
end;
$$;

insert into auth.users (id, email) values
  ('91000000-0000-4000-8000-000000000001', 'jury-admin@test.invalid'),
  ('91000000-0000-4000-8000-000000000002', 'jury-staff@test.invalid'),
  ('91000000-0000-4000-8000-000000000003', 'jury-judge@test.invalid')
on conflict do nothing;
insert into public.profiles (user_id, role, display_name, active) values
  ('91000000-0000-4000-8000-000000000001', 'ADMIN', 'Jury admin', true),
  ('91000000-0000-4000-8000-000000000002', 'STAFF', 'Jury staff', true),
  ('91000000-0000-4000-8000-000000000003', 'JUDGE', 'Jury judge', true)
on conflict (user_id) do update set role = excluded.role, active = excluded.active;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into public.audience_jury_reservations (event_id, department, student_number, attendee_name)
values ('00000000-0000-4000-8000-000000000100', '경영학과', '20260001', '김학생');
reset role;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) = 0 from public.audience_jury_reservations),
  'judge must not read audience jury personal data'
);
reset role;

set local role anon;
do $$
declare blocked boolean := false;
begin
  begin perform public.get_audience_jury_state('00000000-0000-4000-8000-000000000100', 'jury-session-token-000000000001');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'ASSERTION_FAILED: anon direct jury RPC must be denied'; end if;
end;
$$;
reset role;

set local role service_role;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.register_audience_jury(
      '00000000-0000-4000-8000-000000000100', 'jury-session-token-000000000001',
      '경영학과', '김학생', '20260001'
    );
  exception when others then
    if position('PAPER_SIGNATURE_REQUIRED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: unsigned attendee must be rejected'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
set local role authenticated;
update public.audience_jury_reservations set paper_signed_at = now()
where event_id = '00000000-0000-4000-8000-000000000100' and student_number = '20260001';
reset role;

set local role service_role;
select * from public.register_audience_jury(
  '00000000-0000-4000-8000-000000000100', 'jury-session-token-000000000001',
  '경영학과', '김학생', '20260001'
);
reset role;

select pg_temp.assert_true(
  (select pcu_code = 'PCU-101' and paper_signed_at is not null and qr_checked_in_at is not null
   from public.audience_jury_reservations
   where event_id = '00000000-0000-4000-8000-000000000100' and student_number = '20260001'),
  'signed attendee must receive first department PCU code'
);
select pg_temp.assert_true(
  (select session_token_hash <> 'jury-session-token-000000000001' and length(session_token_hash) = 64
   from public.audience_jury_reservations
   where event_id = '00000000-0000-4000-8000-000000000100' and student_number = '20260001'),
  'plaintext session token must never be stored'
);

set local role anon;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.authenticate_audience_jury(
      '00000000-0000-4000-8000-000000000100', '김학생', '20260001', 'PCU-101',
      'jury-auth-token-0000000000000001'
    );
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'ASSERTION_FAILED: anon direct authentication RPC must be denied'; end if;
end;
$$;
reset role;

set local role service_role;
select public.authenticate_audience_jury(
  '00000000-0000-4000-8000-000000000100', '김학생', '20260001', 'PCU-101',
  'jury-auth-token-0000000000000001'
);
update public.teams
set name = case presentation_order when 1 then 'TEST STARTUP 01' when 2 then 'TEST STARTUP 02' end
where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order in (1, 2);
update public.events
set voting_status = 'OPEN', active_team_id = (
  select id from public.teams
  where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1
)
where id = '00000000-0000-4000-8000-000000000100';

select public.submit_audience_rank_ballot(
  '00000000-0000-4000-8000-000000000100',
  'jury-auth-token-0000000000000001', 'STARTUP',
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1),
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 2)
);

do $$
declare blocked boolean := false;
begin
  begin
    perform public.submit_audience_rank_ballot(
      '00000000-0000-4000-8000-000000000100',
      'jury-auth-token-0000000000000001', 'STARTUP',
      (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 2),
      (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1)
    );
  exception when others then
    if position('ALREADY_SUBMITTED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: duplicate category ballot must be rejected'; end if;
end;
$$;
reset role;

select pg_temp.assert_true(
  (select count(*) = 1 from public.audience_rank_ballots
   where event_id = '00000000-0000-4000-8000-000000000100' and category = 'STARTUP'),
  'ranked ballot must persist exactly once per jury and category'
);

insert into public.audience_jury_reservations (
  event_id, department, student_number, attendee_name, paper_signed_at
)
select '00000000-0000-4000-8000-000000000100', 'IT경영정보학과',
  '20261' || lpad(series::text, 3, '0'), '학생' || series, now()
from generate_series(1, 21) series;

set local role service_role;
do $$
declare series integer;
begin
  for series in 1..20 loop
    perform public.register_audience_jury(
      '00000000-0000-4000-8000-000000000100',
      'jury-it-token-00000000000000' || lpad(series::text, 2, '0'),
      'IT경영정보학과', '학생' || series, '20261' || lpad(series::text, 3, '0')
    );
  end loop;
end;
$$;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.register_audience_jury(
      '00000000-0000-4000-8000-000000000100', 'jury-it-token-0000000000000021',
      'IT경영정보학과', '학생21', '20261021'
    );
  exception when others then
    if position('DEPARTMENT_CAPACITY_REACHED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: 21st department attendee must be rejected'; end if;
end;
$$;
reset role;

select pg_temp.assert_true(
  (select count(*) = 20 and min(pcu_code) = 'PCU201' and max(pcu_code) = 'PCU220'
   from public.audience_jury_reservations
   where event_id = '00000000-0000-4000-8000-000000000100'
     and department = 'IT경영정보학과' and pcu_code is not null),
  'department allocation must stay inside PCU201-PCU220'
);

rollback;
