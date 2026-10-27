\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000009001', 'p0b-admin@example.invalid'),
  ('00000000-0000-4000-8000-000000009101', 'p0b-judge-1@example.invalid'),
  ('00000000-0000-4000-8000-000000009102', 'p0b-judge-2@example.invalid'),
  ('00000000-0000-4000-8000-000000009103', 'p0b-judge-3@example.invalid')
on conflict (id) do nothing;

insert into public.profiles (user_id, role, display_name, active) values
  ('00000000-0000-4000-8000-000000009001', 'ADMIN', 'P0-B Test Admin', true),
  ('00000000-0000-4000-8000-000000009101', 'JUDGE', 'P0-B Test Judge 1', true),
  ('00000000-0000-4000-8000-000000009102', 'JUDGE', 'P0-B Test Judge 2', true),
  ('00000000-0000-4000-8000-000000009103', 'JUDGE', 'P0-B Test Judge 3', true)
on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name, active = true;

delete from public.judge_score_revisions;
delete from public.judge_scores;
delete from public.judge_submissions;
delete from public.judge_assignments where event_id = '00000000-0000-4000-8000-000000000100';
delete from public.evaluation_criteria where event_id = '00000000-0000-4000-8000-000000000100';
delete from public.audience_submissions where event_id = '00000000-0000-4000-8000-000000000100';
delete from public.team_vote_sessions where event_id = '00000000-0000-4000-8000-000000000100';
delete from public.audience_attendance_sessions where event_id = '00000000-0000-4000-8000-000000000100';
delete from public.check_ins where event_id = '00000000-0000-4000-8000-000000000100';
delete from public.participants where event_id = '00000000-0000-4000-8000-000000000100';

update public.teams
set status = 'WAITING', active = true
where event_id = '00000000-0000-4000-8000-000000000100';

update public.teams
set name = 'P0-B 검증팀'
where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3;

update public.events
set mode = 'REHEARSAL', status = 'CHECK_IN_OPEN', voting_status = 'READY',
    active_team_id = null, display_mode = 'HOLDING', result_status = 'LOCKED', reveal_step = 0
where id = '00000000-0000-4000-8000-000000000100';

insert into public.evaluation_criteria (id, event_id, scope, name, max_score, weight, order_index, active) values
  ('00000000-0000-4000-8000-000000009201', '00000000-0000-4000-8000-000000000100', 'JUDGE', 'P0-B 평가항목 A', 100, 1, 1, true),
  ('00000000-0000-4000-8000-000000009202', '00000000-0000-4000-8000-000000000100', 'JUDGE', 'P0-B 평가항목 B', 100, 1, 2, true);

insert into public.judge_assignments (event_id, judge_user_id, team_id)
select
  '00000000-0000-4000-8000-000000000100',
  judge.user_id,
  team.id
from (values
  ('00000000-0000-4000-8000-000000009101'::uuid),
  ('00000000-0000-4000-8000-000000009102'::uuid),
  ('00000000-0000-4000-8000-000000009103'::uuid)
) judge(user_id)
cross join lateral (
  select id from public.teams
  where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3
) team;
