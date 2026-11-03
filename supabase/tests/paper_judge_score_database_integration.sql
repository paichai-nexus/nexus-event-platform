\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION_FAILED: %', message; end if;
end;
$$;

insert into auth.users (id, email) values
  ('93000000-0000-4000-8000-000000000001', 'paper-admin@test.invalid'),
  ('93000000-0000-4000-8000-000000000002', 'paper-judge@test.invalid')
on conflict do nothing;
insert into public.profiles (user_id, role, display_name, active) values
  ('93000000-0000-4000-8000-000000000001', 'ADMIN', 'Paper admin', true),
  ('93000000-0000-4000-8000-000000000002', 'JUDGE', 'Paper judge', true)
on conflict (user_id) do update set role = excluded.role, active = excluded.active;

update public.events set status = 'CHECK_IN_OPEN', result_status = 'LOCKED'
where id = '00000000-0000-4000-8000-000000000100';

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select * from public.record_paper_judge_score(
  '00000000-0000-4000-8000-000000000100'::uuid,
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
  1::smallint, 42, 88, 45, false
);
select * from public.record_paper_judge_score(
  '00000000-0000-4000-8000-000000000100'::uuid,
  (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
  1::smallint, 44, 90, 46, true
);
select pg_temp.assert_true(
  (select total_score = 180 and status = 'SUBMITTED' from public.paper_judge_scores
   where event_id = '00000000-0000-4000-8000-000000000100' and judge_slot = 1),
  'paper score must persist 50+100+50 sections and generated total'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.paper_judge_score_revisions),
  'draft correction must preserve one prior revision'
);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.record_paper_judge_score(
      '00000000-0000-4000-8000-000000000100'::uuid,
      (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
      1::smallint, 45, 90, 46, false
    );
  exception when others then
    if position('PAPER_SUBMISSION_LOCKED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: submitted paper score must be immutable'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.record_paper_judge_score(
      '00000000-0000-4000-8000-000000000100'::uuid,
      (select id from public.teams where event_id = '00000000-0000-4000-8000-000000000100' and presentation_order = 3),
      2::smallint, 40, 80, 40, false
    );
  exception when others then
    if position('FORBIDDEN' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: judge role must not use staff paper-entry RPC'; end if;
end;
$$;
reset role;

rollback;
