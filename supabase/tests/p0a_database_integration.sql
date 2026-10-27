\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION_FAILED: %', message; end if;
end;
$$;

insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-000000000001', 'admin@test.invalid'),
  ('90000000-0000-4000-8000-000000000002', 'staff@test.invalid'),
  ('90000000-0000-4000-8000-000000000003', 'judge1@test.invalid'),
  ('90000000-0000-4000-8000-000000000004', 'judge2@test.invalid'),
  ('90000000-0000-4000-8000-000000000005', 'inactive@test.invalid')
on conflict do nothing;

insert into public.profiles (user_id, role, display_name, active) values
  ('90000000-0000-4000-8000-000000000001', 'ADMIN', 'Test admin', true),
  ('90000000-0000-4000-8000-000000000002', 'STAFF', 'Test staff', true),
  ('90000000-0000-4000-8000-000000000003', 'JUDGE', 'Test judge 1', true),
  ('90000000-0000-4000-8000-000000000004', 'JUDGE', 'Test judge 2', true),
  ('90000000-0000-4000-8000-000000000005', 'ADMIN', 'Inactive admin', false)
on conflict (user_id) do update set role = excluded.role, active = excluded.active;

update public.teams set status = 'WAITING'
where event_id = '00000000-0000-4000-8000-000000000100';
update public.events set status = 'CHECK_IN_OPEN', voting_status = 'READY', active_team_id = null,
  result_status = 'LOCKED', mode = 'REHEARSAL'
where id = '00000000-0000-4000-8000-000000000100';

insert into public.evaluation_criteria (
  id, event_id, scope, name, max_score, weight, order_index, active
) values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', 'JUDGE', 'Test criterion 1', 100, 1, 0, true),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000100', 'JUDGE', 'Test criterion 2', 100, 1, 1, true)
on conflict do nothing;

insert into public.judge_assignments (event_id, judge_user_id, team_id)
select '00000000-0000-4000-8000-000000000100', '90000000-0000-4000-8000-000000000003', id
from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3
on conflict do nothing;

-- Public roles cannot bypass the API allowlist after 013.
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin perform id from public.events limit 1;
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'ASSERTION_FAILED: anon events read must be denied'; end if;
end;
$$;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.submit_audience_vote(
      '00000000-0000-4000-8000-000000000100',
      'stolen-audience-token-000000000001'
    );
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'ASSERTION_FAILED: anon direct vote RPC must be denied'; end if;
end;
$$;
reset role;

-- The server-only service role creates and reads the attendance credential.
set local role service_role;
select * from public.enter_audience_attendance(
  '00000000-0000-4000-8000-000000000100',
  'p0a-audience-token-00000000000001'
);
reset role;

-- Admin activates the team and opens its vote session.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.activate_event_team(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3)
);
select public.set_event_voting_status('00000000-0000-4000-8000-000000000100', 'OPEN');
reset role;

set local role service_role;
select public.submit_audience_vote(
  '00000000-0000-4000-8000-000000000100',
  'p0a-audience-token-00000000000001'
);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.submit_audience_vote(
      '00000000-0000-4000-8000-000000000100',
      'p0a-audience-token-00000000000001'
    );
  exception when others then
    if position('ALREADY_SUBMITTED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: duplicate vote must be rejected'; end if;
end;
$$;
reset role;

select pg_temp.assert_true(
  (select count(*) = 1 from public.audience_submissions submission
   join public.team_vote_sessions session on session.id = submission.vote_session_id
   where session.event_id = '00000000-0000-4000-8000-000000000100'
     and session.team_id = (select id from public.teams where event_id = session.event_id and presentation_order = 3)),
  'exactly one vote must persist'
);

-- Closing the session blocks all later submissions before duplicate handling.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.set_event_voting_status('00000000-0000-4000-8000-000000000100', 'CLOSED');
reset role;
set local role service_role;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.submit_audience_vote(
      '00000000-0000-4000-8000-000000000100',
      'p0a-audience-token-00000000000001'
    );
  exception when others then
    if position('VOTING_CLOSED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: closed session must reject votes'; end if;
end;
$$;
reset role;

-- A credential from event A is not eligible in event B.
insert into public.events (id, name, starts_at, ends_at, venue, mode, status, voting_status)
values (
  '00000000-0000-4000-8000-000000000200', 'Isolation event', now(), now() + interval '1 hour',
  'Test venue', 'REHEARSAL', 'CHECK_IN_OPEN', 'READY'
);
insert into public.teams (id, event_id, name, category, presentation_order, status)
values (
  '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000200',
  'Isolation team', 'STARTUP', 1, 'WAITING'
);
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.activate_event_team('00000000-0000-4000-8000-000000000200', '00000000-0000-4000-8000-000000000201');
select public.set_event_voting_status('00000000-0000-4000-8000-000000000200', 'OPEN');
reset role;
set local role service_role;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.submit_audience_vote(
      '00000000-0000-4000-8000-000000000200',
      'p0a-audience-token-00000000000001'
    );
  exception when others then
    if position('NOT_ELIGIBLE' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: cross-event token must be rejected'; end if;
end;
$$;
reset role;

-- Judge draft, submission lock, admin unlock, revision, and final lock.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select public.save_judge_scores(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
  '[{"criterionId":"a0000000-0000-4000-8000-000000000001","score":80},{"criterionId":"a0000000-0000-4000-8000-000000000002","score":90}]'::jsonb
);
select public.submit_judge_scores(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3)
);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.save_judge_scores(
      '00000000-0000-4000-8000-000000000100',
      (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
      '[{"criterionId":"a0000000-0000-4000-8000-000000000001","score":1}]'::jsonb
    );
  exception when others then
    if position('FINAL_SUBMISSION_READ_ONLY' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: submitted judge scores must be read-only'; end if;
end;
$$;
reset role;

set local role anon;
do $$
begin
  if (select count(*) from public.judge_scores) <> 0 then
    raise exception 'ASSERTION_FAILED: anon must not see judge scores';
  end if;
end;
$$;
reset role;

-- Another judge cannot write the assigned judge's team.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.save_judge_scores(
      '00000000-0000-4000-8000-000000000100',
      (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
      '[{"criterionId":"a0000000-0000-4000-8000-000000000001","score":1}]'::jsonb
    );
  exception when others then
    if position('ASSIGNMENT_REQUIRED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: other judge score write must be denied'; end if;
end;
$$;
reset role;

-- STAFF and inactive ADMIN identities cannot unlock a submission.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.unlock_judge_submission(
      (select id from public.judge_submissions where judge_user_id = '90000000-0000-4000-8000-000000000003'),
      'Staff must not unlock'
    );
  exception when others then
    if position('FORBIDDEN' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: staff unlock must be denied'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000005', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.unlock_judge_submission(
      (select id from public.judge_submissions where judge_user_id = '90000000-0000-4000-8000-000000000003'),
      'Inactive admin must not unlock'
    );
  exception when others then
    if position('FORBIDDEN' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: inactive admin unlock must be denied'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.unlock_judge_submission(
  (select id from public.judge_submissions where judge_user_id = '90000000-0000-4000-8000-000000000003'),
  'P0-A controlled correction'
);
reset role;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select public.save_judge_scores(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
  '[{"criterionId":"a0000000-0000-4000-8000-000000000001","score":85},{"criterionId":"a0000000-0000-4000-8000-000000000002","score":90}]'::jsonb
);
select public.submit_judge_scores(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3)
);
reset role;

select pg_temp.assert_true(
  (select count(*) >= 1 from public.judge_score_revisions revision
   join public.judge_submissions submission on submission.id = revision.submission_id
   where submission.judge_user_id = '90000000-0000-4000-8000-000000000003'),
  'judge score revision must be preserved'
);

update public.events set result_status = 'FINALIZED'
where id = '00000000-0000-4000-8000-000000000100';
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.unlock_judge_submission(
      (select id from public.judge_submissions where judge_user_id = '90000000-0000-4000-8000-000000000003'),
      'Must remain locked after finalization'
    );
  exception when others then
    if position('RESULT_FINALIZED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: finalized result must block unlock'; end if;
end;
$$;
reset role;

rollback;
\echo 'P0-A database integration assertions passed.'
