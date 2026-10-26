-- Prepared for review; do not apply to the operating database without approval.
create type public.prize_definition_status as enum ('UNCONFIRMED', 'CONFIRMED');
create type public.prize_catalog_draw_status as enum ('READY', 'IN_PROGRESS', 'COMPLETED');

create table public.prize_catalog (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rank integer not null check (rank between 2 and 12),
  name text,
  image_url text,
  quantity integer check (quantity is null or quantity > 0),
  winner_count integer check (winner_count is null or winner_count > 0),
  status public.prize_definition_status not null default 'UNCONFIRMED',
  draw_status public.prize_catalog_draw_status not null default 'READY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, rank),
  constraint confirmed_prize_requires_details check (
    status = 'UNCONFIRMED' or (name is not null and quantity is not null and winner_count is not null)
  )
);

create trigger prize_catalog_set_updated_at before update on public.prize_catalog
for each row execute function public.set_updated_at();

alter table public.prize_catalog enable row level security;
create policy prize_catalog_staff_read on public.prize_catalog for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));
create policy prize_catalog_staff_manage on public.prize_catalog for all to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'))
with check (public.current_app_role() in ('ADMIN', 'STAFF'));

insert into public.prize_catalog (event_id, rank)
select '00000000-0000-4000-8000-000000000100', rank
from generate_series(2, 12) as rank
on conflict (event_id, rank) do nothing;
