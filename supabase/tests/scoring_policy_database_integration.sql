\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if not coalesce(value, false) then raise exception 'ASSERTION_FAILED: %', message; end if; end;
$$;

insert into auth.users (id, email) values
  ('95000000-0000-4000-8000-000000000001', 'policy-admin@test.invalid'),
  ('95000000-0000-4000-8000-000000000002', 'policy-staff@test.invalid'),
  ('95000000-0000-4000-8000-000000000003', 'policy-judge@test.invalid')
on conflict do nothing;
insert into public.profiles (user_id, role, display_name, active) values
  ('95000000-0000-4000-8000-000000000001', 'ADMIN', 'Policy admin', true),
  ('95000000-0000-4000-8000-000000000002', 'STAFF', 'Policy staff', true),
  ('95000000-0000-4000-8000-000000000003', 'JUDGE', 'Policy judge', true)
on conflict (user_id) do update set role = excluded.role, active = true;

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
set local role authenticated;
insert into public.scoring_policy_versions (
  id, event_id, version, professional_weight, audience_weight, judge_count, professional_max_per_judge
) values (
  '95000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000100',
  '2026-INTEGRATION', 70, 30, 3, 200
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.scoring_policy_versions where event_id = '00000000-0000-4000-8000-000000000100'),
  'staff must read the event-scoped draft'
);
do $$ declare blocked boolean := false; begin
  begin perform public.approve_scoring_policy('00000000-0000-4000-8000-000000000100', '95000000-0000-4000-8000-000000000100');
  exception when others then if position('FORBIDDEN' in sqlerrm) > 0 then blocked := true; else raise; end if; end;
  if not blocked then raise exception 'ASSERTION_FAILED: staff must not approve scoring policy'; end if;
end; $$;
reset role;

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) = 0 from public.scoring_policy_versions where event_id = '00000000-0000-4000-8000-000000000100'),
  'judge must not read scoring governance records'
);
reset role;

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$ declare blocked boolean := false; begin
  begin perform public.approve_scoring_policy('00000000-0000-4000-8000-000000000100', '95000000-0000-4000-8000-000000000100');
  exception when others then if position('SCORING_POLICY_INCOMPLETE' in sqlerrm) > 0 then blocked := true; else raise; end if; end;
  if not blocked then raise exception 'ASSERTION_FAILED: incomplete policy must not be approved'; end if;
end; $$;

update public.scoring_policy_versions set
  audience_conversion_rule = '승인된 청중점수 환산식',
  tie_break_rule = '승인된 동점 처리 규칙',
  category_aggregation_rule = '창업·기업분석 부문 분리 집계'
where id = '95000000-0000-4000-8000-000000000100';
select * from public.approve_scoring_policy(
  '00000000-0000-4000-8000-000000000100', '95000000-0000-4000-8000-000000000100'
);
select pg_temp.assert_true(
  (select status = 'APPROVED' and approved_by = '95000000-0000-4000-8000-000000000001'
   from public.scoring_policy_versions where id = '95000000-0000-4000-8000-000000000100'),
  'admin approval and actor must persist'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.audit_logs where action = 'SCORING_POLICY_APPROVE' and target_id = '95000000-0000-4000-8000-000000000100'),
  'policy approval must create exactly one audit log'
);
select pg_temp.assert_true(
  (select result_status = 'LOCKED' from public.events where id = '00000000-0000-4000-8000-000000000100'),
  'policy document approval must not unlock official results'
);
do $$ declare blocked boolean := false; begin
  begin insert into public.scoring_policy_versions (
    event_id, version, professional_weight, audience_weight, judge_count, professional_max_per_judge
  ) values ('00000000-0000-4000-8000-000000000100', '2026-REOPEN', 70, 30, 3, 200);
  exception when others then if position('SCORING_POLICY_ALREADY_APPROVED' in sqlerrm) > 0 then blocked := true; else raise; end if; end;
  if not blocked then raise exception 'ASSERTION_FAILED: approved policy must not be reopened'; end if;
end; $$;
reset role;

set local role anon;
select pg_temp.assert_true(
  (select count(*) = 0 from public.scoring_policy_versions),
  'anonymous users must not read scoring governance records'
);
reset role;

rollback;
