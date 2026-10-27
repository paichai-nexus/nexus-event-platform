\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('91000000-0000-4000-8000-000000000001', 'concurrency-admin@test.invalid')
on conflict do nothing;
insert into public.profiles (user_id, role, display_name, active) values
  ('91000000-0000-4000-8000-000000000001', 'ADMIN', 'Concurrency admin', true)
on conflict (user_id) do update set role = excluded.role, active = true;

update public.teams set status = 'WAITING'
where event_id = '00000000-0000-4000-8000-000000000100';
update public.events set status = 'CHECK_IN_OPEN', voting_status = 'READY', active_team_id = null,
  result_status = 'LOCKED', mode = 'REHEARSAL'
where id = '00000000-0000-4000-8000-000000000100';
delete from public.audience_submissions
where event_id = '00000000-0000-4000-8000-000000000100';
delete from public.team_vote_sessions
where event_id = '00000000-0000-4000-8000-000000000100';

set role service_role;
select * from public.enter_audience_attendance(
  '00000000-0000-4000-8000-000000000100',
  'p0a-concurrent-token-00000000000001'
);
reset role;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', false);
set role authenticated;
select public.activate_event_team(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3)
);
select public.set_event_voting_status('00000000-0000-4000-8000-000000000100', 'OPEN');
reset role;
