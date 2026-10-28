\set ON_ERROR_STOP on

-- Isolated P0-C diagnostics fixture. Never apply to staging or production.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000009001', 'p0c-admin@example.invalid'),
  ('00000000-0000-4000-8000-000000009002', 'p0c-staff@example.invalid'),
  ('00000000-0000-4000-8000-000000009101', 'p0c-judge-1@example.invalid'),
  ('00000000-0000-4000-8000-000000009102', 'p0c-judge-2@example.invalid'),
  ('00000000-0000-4000-8000-000000009103', 'p0c-judge-3@example.invalid')
on conflict (id) do nothing;

insert into public.profiles (user_id, role, display_name, active) values
  ('00000000-0000-4000-8000-000000009001', 'ADMIN', 'P0-C Test Admin', true),
  ('00000000-0000-4000-8000-000000009002', 'STAFF', 'P0-C Test Staff', true),
  ('00000000-0000-4000-8000-000000009101', 'JUDGE', 'P0-C Test Judge 1', true),
  ('00000000-0000-4000-8000-000000009102', 'JUDGE', 'P0-C Test Judge 2', true),
  ('00000000-0000-4000-8000-000000009103', 'JUDGE', 'P0-C Test Judge 3', true)
on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name, active = true;

delete from public.judge_score_revisions;
delete from public.judge_scores;
delete from public.judge_submissions;
delete from public.judge_assignments;
delete from public.evaluation_criteria;
delete from public.audience_submissions;
delete from public.team_vote_sessions;
delete from public.audience_attendance_sessions;
delete from public.check_ins;
delete from public.participants;
delete from public.events where id = '00000000-0000-4000-8000-000000000110';

update public.teams
set name = case presentation_order
  when 1 then 'P0-C 완전제출팀'
  when 2 then 'P0-C 누락제출팀'
  else null
end,
status = 'WAITING', active = presentation_order in (1, 2)
where event_id = '00000000-0000-4000-8000-000000000100';

update public.events
set mode = 'REHEARSAL', status = 'SCORING', voting_status = 'CLOSED',
    active_team_id = null, display_mode = 'HOLDING', result_status = 'LOCKED', reveal_step = 0
where id = '00000000-0000-4000-8000-000000000100';

insert into public.events (
  id, name, starts_at, ends_at, venue, mode, status, voting_status,
  display_mode, result_status, reveal_step
) values (
  '00000000-0000-4000-8000-000000000110', 'P0-C 격리 검증 행사',
  '2026-12-01 13:00:00+09', '2026-12-01 18:00:00+09', '격리 테스트 장소',
  'REHEARSAL', 'SCORING', 'CLOSED', 'HOLDING', 'LOCKED', 0
);

insert into public.teams (id, event_id, name, category, presentation_order, status, active) values
  ('00000000-0000-4000-8000-000000000120', '00000000-0000-4000-8000-000000000110', 'P0-C 타행사팀', 'STARTUP', 1, 'DONE', true);

insert into public.evaluation_criteria (id, event_id, scope, name, max_score, weight, order_index, active) values
  ('00000000-0000-4000-8000-000000009201', '00000000-0000-4000-8000-000000000100', 'JUDGE', 'P0-C 기준 A', 100, 1, 1, true),
  ('00000000-0000-4000-8000-000000009202', '00000000-0000-4000-8000-000000000100', 'JUDGE', 'P0-C 기준 B', 100, 1, 2, true),
  ('00000000-0000-4000-8000-000000009211', '00000000-0000-4000-8000-000000000110', 'JUDGE', 'P0-C 타행사 기준', 200, 1, 1, true);

insert into public.judge_assignments (event_id, judge_user_id, team_id) values
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009101', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1)),
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009102', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1)),
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009101', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 2)),
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009102', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 2)),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000009103', '00000000-0000-4000-8000-000000000120');

insert into public.judge_submissions (id, event_id, judge_user_id, team_id, status, submitted_at) values
  ('00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009101', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1), 'DRAFT', null),
  ('00000000-0000-4000-8000-000000009302', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009102', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1), 'DRAFT', null),
  ('00000000-0000-4000-8000-000000009303', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009101', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 2), 'DRAFT', null),
  ('00000000-0000-4000-8000-000000009311', '00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000009103', '00000000-0000-4000-8000-000000000120', 'DRAFT', null);

insert into public.judge_scores (submission_id, criterion_id, score) values
  ('00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-000000009201', 100),
  ('00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-000000009202', 50),
  ('00000000-0000-4000-8000-000000009302', '00000000-0000-4000-8000-000000009201', 80),
  ('00000000-0000-4000-8000-000000009302', '00000000-0000-4000-8000-000000009202', 20),
  ('00000000-0000-4000-8000-000000009303', '00000000-0000-4000-8000-000000009201', 70),
  ('00000000-0000-4000-8000-000000009311', '00000000-0000-4000-8000-000000009211', 199);

insert into public.team_vote_sessions (id, event_id, team_id, status, eligibility_count, opened_at, closed_at) values
  ('00000000-0000-4000-8000-000000009501', '00000000-0000-4000-8000-000000000100', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1), 'CLOSED', 3, now() - interval '10 minutes', now()),
  ('00000000-0000-4000-8000-000000009502', '00000000-0000-4000-8000-000000000100', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 2), 'CLOSED', 3, now() - interval '10 minutes', now()),
  ('00000000-0000-4000-8000-000000009511', '00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000120', 'CLOSED', 2, now() - interval '10 minutes', now());

insert into public.participants (id, event_id, participant_code, display_label, active) values
  ('00000000-0000-4000-8000-000000009401', '00000000-0000-4000-8000-000000000100', 'P0C-A-1', 'P0-C A1', true),
  ('00000000-0000-4000-8000-000000009402', '00000000-0000-4000-8000-000000000100', 'P0C-A-2', 'P0-C A2', true),
  ('00000000-0000-4000-8000-000000009403', '00000000-0000-4000-8000-000000000100', 'P0C-A-3', 'P0-C A3', true),
  ('00000000-0000-4000-8000-000000009411', '00000000-0000-4000-8000-000000000110', 'P0C-B-1', 'P0-C B1', true);

insert into public.audience_submissions (id, event_id, participant_id, team_id, vote_session_id) values
  ('00000000-0000-4000-8000-000000009601', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009401', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1), '00000000-0000-4000-8000-000000009501'),
  ('00000000-0000-4000-8000-000000009602', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009402', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 1), '00000000-0000-4000-8000-000000009501'),
  ('00000000-0000-4000-8000-000000009603', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000009403', (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 2), '00000000-0000-4000-8000-000000009502'),
  ('00000000-0000-4000-8000-000000009611', '00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000009411', '00000000-0000-4000-8000-000000000120', '00000000-0000-4000-8000-000000009511');

-- The schema must reject duplicate assignment, submission, and score keys.
do $$
begin
  begin
    insert into public.judge_assignments (event_id, judge_user_id, team_id)
    select event_id, judge_user_id, team_id from public.judge_assignments order by id limit 1;
    raise exception 'ASSERTION_FAILED: duplicate assignment was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.judge_submissions (event_id, judge_user_id, team_id)
    select event_id, judge_user_id, team_id from public.judge_submissions where id = '00000000-0000-4000-8000-000000009301';
    raise exception 'ASSERTION_FAILED: duplicate submission was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.judge_scores (submission_id, criterion_id, score)
    values ('00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-000000009201', 1);
    raise exception 'ASSERTION_FAILED: duplicate score was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

update public.judge_submissions
set status = 'SUBMITTED', submitted_at = now()
where id in (
  '00000000-0000-4000-8000-000000009301',
  '00000000-0000-4000-8000-000000009302',
  '00000000-0000-4000-8000-000000009303',
  '00000000-0000-4000-8000-000000009311'
);
