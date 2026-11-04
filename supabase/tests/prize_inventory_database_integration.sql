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

select pg_temp.assert_true(
  (select count(*) = 6 and sum(winner_count) = 35 and sum(unit_amount * quantity) = 910000
   from public.prize_inventory
   where event_id = '00000000-0000-4000-8000-000000000100' and status = 'CONFIRMED'),
  'confirmed draw inventory must contain six items, 35 winners, and 910000 won total budget'
);

insert into public.audience_jury_reservations (
  event_id, department, student_number, attendee_name, paper_signed_at
) values ('00000000-0000-4000-8000-000000000100', '경영학과', '20269999', '경품학생', now());
set local role service_role;
select * from public.register_audience_jury(
  '00000000-0000-4000-8000-000000000100', 'prize-jury-token-00000000000001',
  '경영학과', '경품학생', '20269999'
);
reset role;

insert into public.participants (event_id, participant_code, display_label, affiliation)
values ('00000000-0000-4000-8000-000000000100', 'GENERAL-001', 'GENERAL-001', 'GENERAL')
on conflict (event_id, participant_code) do nothing;
insert into public.check_ins (event_id, participant_id, source)
select '00000000-0000-4000-8000-000000000100', participant.id, 'MANUAL'
from public.participants participant
where participant.event_id = '00000000-0000-4000-8000-000000000100' and participant.participant_code = 'GENERAL-001'
on conflict (event_id, participant_id) do nothing;

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select * from public.draw_prize_item_winner(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.prize_inventory where event_id = '00000000-0000-4000-8000-000000000100'
    and pool = 'AUDIENCE_JURY' and display_order = 1)
);
select * from public.draw_prize_item_winner(
  '00000000-0000-4000-8000-000000000100',
  (select id from public.prize_inventory where event_id = '00000000-0000-4000-8000-000000000100'
    and pool = 'ALL_PARTICIPANTS' and display_order = 4)
);
reset role;

select pg_temp.assert_true(
  (select count(*) = 2 and count(distinct participant_id) = 2 from public.prize_item_draws
   where event_id = '00000000-0000-4000-8000-000000000100'),
  'pool draws must persist two distinct winners'
);
select pg_temp.assert_true(
  (select participant.participant_code = 'GENERAL-001'
   from public.prize_item_draws item_draw join public.participants participant on participant.id = item_draw.participant_id
   join public.prize_inventory item on item.id = item_draw.prize_item_id
   where item.pool = 'ALL_PARTICIPANTS'),
  'global duplicate prevention must exclude the prior audience-jury winner'
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
        and pool = 'ALL_PARTICIPANTS' and display_order = 4)
    );
  exception when others then
    if position('PRIZE_DRAW_COMPLETED' in sqlerrm) > 0 then blocked := true; else raise; end if;
  end;
  if not blocked then raise exception 'ASSERTION_FAILED: completed one-winner prize must reject another draw'; end if;
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
