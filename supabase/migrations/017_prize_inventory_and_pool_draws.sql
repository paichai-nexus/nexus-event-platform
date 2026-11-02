-- Confirmed event prize inventory and pool-scoped, server-side draws.

create type public.prize_eligibility_pool as enum ('AUDIENCE_JURY', 'ALL_PARTICIPANTS');

create table public.prize_inventory (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  pool public.prize_eligibility_pool not null,
  display_order integer not null check (display_order > 0),
  name text not null check (length(trim(name)) between 1 and 120),
  unit_amount integer not null check (unit_amount > 0),
  quantity integer not null check (quantity > 0),
  winner_count integer not null check (winner_count > 0 and winner_count <= quantity),
  image_url text,
  status public.prize_definition_status not null default 'CONFIRMED',
  draw_status public.prize_catalog_draw_status not null default 'READY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, pool, display_order)
);

create trigger prize_inventory_set_updated_at before update on public.prize_inventory
for each row execute function public.set_updated_at();

alter table public.prize_inventory enable row level security;
create policy prize_inventory_staff_read on public.prize_inventory for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));
create policy prize_inventory_staff_manage on public.prize_inventory for all to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'))
with check (public.current_app_role() in ('ADMIN', 'STAFF'));
revoke all on public.prize_inventory from anon, authenticated;
grant select, insert, update on public.prize_inventory to authenticated;

create table public.prize_item_draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  prize_item_id uuid not null references public.prize_inventory(id) on delete restrict,
  round integer not null check (round > 0),
  participant_id uuid not null references public.participants(id) on delete restrict,
  drawn_by uuid not null references auth.users(id) on delete restrict,
  drawn_at timestamptz not null default now(),
  status public.prize_draw_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  unique (prize_item_id, round)
);

create unique index prize_item_draws_one_active_win_per_participant
  on public.prize_item_draws (event_id, participant_id)
  where status = 'ACTIVE';

alter table public.prize_item_draws enable row level security;
create policy prize_item_draws_staff_read on public.prize_item_draws for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));
revoke all on public.prize_item_draws from anon, authenticated;
grant select on public.prize_item_draws to authenticated;

create function public.sync_audience_jury_participant()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_participant_id uuid;
begin
  if new.pcu_code is null or new.qr_checked_in_at is null then return new; end if;
  insert into public.participants (event_id, participant_code, display_label, affiliation, active)
  values (new.event_id, new.pcu_code, new.pcu_code, new.department, true)
  on conflict (event_id, participant_code) do update
    set active = true, affiliation = excluded.affiliation
  returning id into selected_participant_id;

  insert into public.check_ins (event_id, participant_id, checked_in_at, source)
  values (new.event_id, selected_participant_id, new.qr_checked_in_at, 'QR')
  on conflict (event_id, participant_id) do nothing;
  return new;
end;
$$;

create trigger audience_jury_sync_participant
after insert or update of pcu_code, qr_checked_in_at on public.audience_jury_reservations
for each row execute function public.sync_audience_jury_participant();
revoke all on function public.sync_audience_jury_participant() from public, anon, authenticated;

do $$
declare reservation public.audience_jury_reservations%rowtype;
  selected_participant_id uuid;
begin
  for reservation in select * from public.audience_jury_reservations where pcu_code is not null and qr_checked_in_at is not null loop
    insert into public.participants (event_id, participant_code, display_label, affiliation, active)
    values (reservation.event_id, reservation.pcu_code, reservation.pcu_code, reservation.department, true)
    on conflict (event_id, participant_code) do update
      set active = true, affiliation = excluded.affiliation
    returning id into selected_participant_id;
    insert into public.check_ins (event_id, participant_id, checked_in_at, source)
    values (reservation.event_id, selected_participant_id, reservation.qr_checked_in_at, 'QR')
    on conflict (event_id, participant_id) do nothing;
  end loop;
end;
$$;

insert into public.prize_inventory (event_id, pool, display_order, name, unit_amount, quantity, winner_count)
values
  ('00000000-0000-4000-8000-000000000100', 'AUDIENCE_JURY', 1, '아웃백 상품권', 80000, 2, 2),
  ('00000000-0000-4000-8000-000000000100', 'AUDIENCE_JURY', 2, '커피 쿠폰', 10000, 6, 6),
  ('00000000-0000-4000-8000-000000000100', 'ALL_PARTICIPANTS', 1, '에어팟', 250000, 1, 1),
  ('00000000-0000-4000-8000-000000000100', 'ALL_PARTICIPANTS', 2, '커피 쿠폰', 10000, 14, 14),
  ('00000000-0000-4000-8000-000000000100', 'ALL_PARTICIPANTS', 3, '올리브영 상품권', 30000, 6, 6),
  ('00000000-0000-4000-8000-000000000100', 'ALL_PARTICIPANTS', 4, '올리브영 상품권', 20000, 6, 6)
on conflict (event_id, pool, display_order) do nothing;

create function public.draw_prize_item_winner(p_event_id uuid, p_prize_item_id uuid)
returns table (
  draw_id uuid,
  prize_item_id uuid,
  prize_name text,
  pool public.prize_eligibility_pool,
  round integer,
  participant_code text,
  drawn_at timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
declare
  selected_prize public.prize_inventory%rowtype;
  selected_participant public.participants%rowtype;
  saved public.prize_item_draws%rowtype;
  next_round integer;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || p_prize_item_id::text, 0));

  select * into selected_prize from public.prize_inventory
  where id = p_prize_item_id and event_id = p_event_id and status = 'CONFIRMED'
  for update;
  if selected_prize.id is null then raise exception 'PRIZE_NOT_FOUND'; end if;

  select coalesce(max(item_draw.round), 0) + 1 into next_round
  from public.prize_item_draws item_draw where item_draw.prize_item_id = selected_prize.id;
  if next_round > selected_prize.winner_count then raise exception 'PRIZE_DRAW_COMPLETED'; end if;

  select participant.* into selected_participant
  from public.participants participant
  join public.check_ins check_in on check_in.event_id = participant.event_id and check_in.participant_id = participant.id
  where participant.event_id = p_event_id and participant.active = true
    and (
      selected_prize.pool = 'ALL_PARTICIPANTS' or exists (
        select 1 from public.audience_jury_reservations jury
        where jury.event_id = p_event_id and jury.pcu_code = participant.participant_code
          and jury.qr_checked_in_at is not null
      )
    )
    and not exists (
      select 1 from public.prize_item_draws previous
      where previous.event_id = p_event_id and previous.participant_id = participant.id and previous.status = 'ACTIVE'
    )
  order by gen_random_uuid()
  limit 1
  for update of participant;
  if selected_participant.id is null then raise exception 'NO_ELIGIBLE_PARTICIPANT'; end if;

  insert into public.prize_item_draws (event_id, prize_item_id, round, participant_id, drawn_by)
  values (p_event_id, selected_prize.id, next_round, selected_participant.id, auth.uid())
  returning * into saved;

  if next_round = selected_prize.winner_count then
    update public.prize_inventory set draw_status = 'COMPLETED' where id = selected_prize.id;
  else
    update public.prize_inventory set draw_status = 'IN_PROGRESS' where id = selected_prize.id;
  end if;

  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'PRIZE_ITEM_DRAW', 'prize_item_draw', saved.id,
    jsonb_build_object('prize_item_id', selected_prize.id, 'participant_id', selected_participant.id, 'round', next_round));

  return query select saved.id, selected_prize.id, selected_prize.name, selected_prize.pool,
    saved.round, selected_participant.participant_code, saved.drawn_at;
end;
$$;

revoke all on function public.draw_prize_item_winner(uuid, uuid) from public;
grant execute on function public.draw_prize_item_winner(uuid, uuid) to authenticated;

comment on table public.prize_inventory is 'Confirmed audience-jury and all-participant prize inventory.';
comment on table public.prize_item_draws is 'Server-selected prize winners with global per-event duplicate prevention.';
