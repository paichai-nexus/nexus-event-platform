\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION_FAILED: %', message; end if;
end;
$$;

insert into auth.users (id, email) values
  ('93000000-0000-4000-8000-000000000001', 'prize-stage-admin@test.invalid'),
  ('93000000-0000-4000-8000-000000000002', 'prize-stage-judge@test.invalid')
on conflict do nothing;
insert into public.profiles (user_id, role, display_name, active) values
  ('93000000-0000-4000-8000-000000000001', 'ADMIN', 'Prize stage admin', true),
  ('93000000-0000-4000-8000-000000000002', 'JUDGE', 'Prize stage judge', true)
on conflict (user_id) do update set role = excluded.role, active = excluded.active;

insert into public.participants (event_id, participant_code, display_label, affiliation)
values ('00000000-0000-4000-8000-000000000100', 'STAGE-001', 'STAGE-001', 'GENERAL')
on conflict (event_id, participant_code) do nothing;
insert into public.check_ins (event_id, participant_id, source)
select '00000000-0000-4000-8000-000000000100', participant.id, 'MANUAL'
from public.participants participant
where participant.event_id = '00000000-0000-4000-8000-000000000100'
  and participant.participant_code = 'STAGE-001'
on conflict (event_id, participant_id) do nothing;

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select * from public.lock_prize_stage_eligibility(
  '00000000-0000-4000-8000-000000000100', 'SECOND'
);
reset role;

select pg_temp.assert_true(
  (select eligible_count = 1 from public.prize_stage_snapshots
   where event_id = '00000000-0000-4000-8000-000000000100' and stage = 'SECOND'),
  'second draw snapshot must freeze the one participant checked in at lock time'
);

insert into public.participants (event_id, participant_code, display_label, affiliation)
values ('00000000-0000-4000-8000-000000000100', 'STAGE-002', 'STAGE-002', 'GENERAL')
on conflict (event_id, participant_code) do nothing;
insert into public.check_ins (event_id, participant_id, source)
select '00000000-0000-4000-8000-000000000100', participant.id, 'MANUAL'
from public.participants participant
where participant.event_id = '00000000-0000-4000-8000-000000000100'
  and participant.participant_code = 'STAGE-002'
on conflict (event_id, participant_id) do nothing;

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select * from public.lock_prize_stage_eligibility(
  '00000000-0000-4000-8000-000000000100', 'SECOND'
);
select * from public.draw_prize_item_winner_for_stage(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.prize_inventory
   where event_id = '00000000-0000-4000-8000-000000000100'
     and pool = 'ALL_PARTICIPANTS' and display_order = 1),
  'SECOND'
);
reset role;

select pg_temp.assert_true(
  (select eligible_count = 1 from public.prize_stage_snapshots
   where event_id = '00000000-0000-4000-8000-000000000100' and stage = 'SECOND'),
  're-locking a stage must not add a participant who checked in after the snapshot'
);
select pg_temp.assert_true(
  (select participant.participant_code = 'STAGE-001'
   from public.prize_item_draws item_draw
   join public.participants participant on participant.id = item_draw.participant_id
   where item_draw.event_id = '00000000-0000-4000-8000-000000000100'),
  'stage draw must only select a participant stored in the frozen snapshot'
);

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.lock_prize_stage_eligibility(
      '00000000-0000-4000-8000-000000000100', 'THIRD'
    );
  exception when others then
    if position('FORBIDDEN' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: judge must not lock a prize stage'; end if;
end;
$$;
reset role;

rollback;
