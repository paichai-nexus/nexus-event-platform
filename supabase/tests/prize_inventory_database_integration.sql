\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(value, false) then raise exception 'ASSERTION_FAILED: %', message; end if;
end;
$$;

insert into auth.users (id, email) values
  ('92000000-0000-4000-8000-000000000001', 'prize-admin@test.invalid'),
  ('92000000-0000-4000-8000-000000000002', 'prize-judge@test.invalid')
on conflict do nothing;
insert into public.profiles (user_id, role, display_name, active) values
  ('92000000-0000-4000-8000-000000000001', 'ADMIN', 'Prize admin', true),
  ('92000000-0000-4000-8000-000000000002', 'JUDGE', 'Prize judge', true)
on conflict (user_id) do update set role = excluded.role, active = excluded.active;


-- General-attendee prizes only; audience-jury prizes are excluded.
select pg_temp.assert_true(
  (select count(*) = 1
       and sum(winner_count) = 15
       and sum(unit_amount * quantity) = 150000
   from public.prize_inventory
   where event_id = '00000000-0000-4000-8000-000000000100'
     and status = 'CONFIRMED'
     and pool = 'ALL_PARTICIPANTS'
     and draw_stage = 'FIRST'
     and name = '커피 쿠폰'),
  'general prize inventory must match approved general pool'
);

insert into public.participants
  (event_id, participant_code, display_label, affiliation)
values
  ('00000000-0000-4000-8000-000000000100',
   'GENERAL-001', 'GENERAL-001', 'GENERAL'),
  ('00000000-0000-4000-8000-000000000100',
   'GENERAL-002', 'GENERAL-002', 'GENERAL')
on conflict (event_id, participant_code) do nothing;

insert into public.check_ins (event_id, participant_id, source)
select '00000000-0000-4000-8000-000000000100',
       id, 'MANUAL'
from public.participants
where event_id = '00000000-0000-4000-8000-000000000100'
  and participant_code in ('GENERAL-001', 'GENERAL-002')
on conflict (event_id, participant_id) do nothing;

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select * from public.draw_prize_item_winner(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.prize_inventory
   where event_id = '00000000-0000-4000-8000-000000000100'
     and pool = 'ALL_PARTICIPANTS' and display_order = 1)
);
select * from public.draw_prize_item_winner(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.prize_inventory
   where event_id = '00000000-0000-4000-8000-000000000100'
     and pool = 'ALL_PARTICIPANTS' and display_order = 1)
);
reset role;

select pg_temp.assert_true(
  (select count(*) = 2 and count(distinct participant_id) = 2 from public.prize_item_draws
   where event_id = '00000000-0000-4000-8000-000000000100'),
  'general draws must persist two distinct winners'
);

select pg_temp.assert_true(
  (select count(*) = 2 and count(distinct participant_id) = 2
   from public.prize_item_draws
   where event_id = '00000000-0000-4000-8000-000000000100'),
  'general prizes must not award the same participant twice'
);

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.draw_prize_item_winner(
      '00000000-0000-4000-8000-000000000100',
      (select id from public.prize_inventory where event_id = '00000000-0000-4000-8000-000000000100'
        and pool = 'ALL_PARTICIPANTS' and display_order = 1)
    );
  exception when others then
    if position('NO_ELIGIBLE_PARTICIPANT' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: coffee draw must reject when no eligible participants remain'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.draw_prize_item_winner(
      '00000000-0000-4000-8000-000000000100',
      (select id from public.prize_inventory where event_id = '00000000-0000-4000-8000-000000000100' limit 1)
    );
  exception when others then
    if position('FORBIDDEN' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: judge must not draw prizes'; end if;
end;
$$;
reset role;

rollback;
