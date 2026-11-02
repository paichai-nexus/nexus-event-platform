\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$ begin if not coalesce(value, false) then raise exception 'ASSERTION_FAILED: %', message; end if; end; $$;
insert into auth.users (id, email) values
  ('94000000-0000-4000-8000-000000000001', 'show-admin@test.invalid'),
  ('94000000-0000-4000-8000-000000000002', 'show-staff@test.invalid') on conflict do nothing;
insert into public.profiles (user_id, role, display_name, active) values
  ('94000000-0000-4000-8000-000000000001', 'ADMIN', 'Show admin', true),
  ('94000000-0000-4000-8000-000000000002', 'STAFF', 'Show staff', true)
on conflict (user_id) do update set role = excluded.role, active = true;

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
set local role authenticated;
insert into public.result_show_decks (event_id, judge_comment, awards, best_reviewer) values (
  '00000000-0000-4000-8000-000000000100', '승인 전 심사평', '[{"title":"대상","teamName":"TEAM 01","detail":"테스트"}]',
  '{"participantCode":"PCU101","name":"리뷰어","department":"경영학과","reviewExcerpt":"발표의 장점과 개선점을 구체적으로 제시했습니다."}'
);
do $$ declare blocked boolean := false; begin
  begin perform public.approve_result_show_deck('00000000-0000-4000-8000-000000000100');
  exception when others then if position('FORBIDDEN' in sqlerrm) > 0 then blocked := true; else raise; end if; end;
  if not blocked then raise exception 'ASSERTION_FAILED: staff must not approve show deck'; end if;
end; $$;
reset role;

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select * from public.approve_result_show_deck('00000000-0000-4000-8000-000000000100');
select * from public.set_result_show_scene('00000000-0000-4000-8000-000000000100', 'RESULT');
select * from public.set_result_show_scene('00000000-0000-4000-8000-000000000100', 'BEST_REVIEWER');
select * from public.set_event_display_mode('00000000-0000-4000-8000-000000000100', 'RESULT_SHOW');
select pg_temp.assert_true((select status = 'APPROVED' and current_scene = 'BEST_REVIEWER' from public.result_show_decks where event_id = '00000000-0000-4000-8000-000000000100'), 'admin approval and best-reviewer scene must persist');
select pg_temp.assert_true((select display_mode = 'RESULT_SHOW' and result_status = 'LOCKED' from public.events where id = '00000000-0000-4000-8000-000000000100'), 'result show must not unlock official scoring result');
do $$ declare blocked boolean := false; begin
  begin perform public.set_event_display_mode('00000000-0000-4000-8000-000000000100', 'AWARD_REVEAL');
  exception when others then if position('RESULT_LOCKED' in sqlerrm) > 0 then blocked := true; else raise; end if; end;
  if not blocked then raise exception 'ASSERTION_FAILED: award reveal must remain locked'; end if;
end; $$;
reset role;
rollback;
