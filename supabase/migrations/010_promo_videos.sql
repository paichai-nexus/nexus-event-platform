-- Prepared for review; do not apply to the operating database without approval.
create table public.promo_videos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  video_url text not null,
  thumbnail_url text,
  title text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger promo_videos_set_updated_at before update on public.promo_videos
for each row execute function public.set_updated_at();
alter table public.promo_videos enable row level security;
create policy promo_videos_public_read on public.promo_videos for select to anon, authenticated using (active = true or public.current_app_role() in ('ADMIN', 'STAFF'));
create policy promo_videos_staff_manage on public.promo_videos for all to authenticated using (public.current_app_role() in ('ADMIN', 'STAFF')) with check (public.current_app_role() in ('ADMIN', 'STAFF'));
