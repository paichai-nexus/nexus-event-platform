-- Prepared for review; do not apply to the operating database without approval.
-- Team names remain nullable until the official roster is delivered.
alter table public.teams alter column name drop not null;

update public.teams
set
  name = null,
  category = case when presentation_order <= 10 then 'STARTUP'::public.team_category else 'BUSINESS_ANALYSIS'::public.team_category end,
  status = 'WAITING'::public.team_status,
  active = true
where event_id = '00000000-0000-4000-8000-000000000100'
  and presentation_order between 1 and 19;

insert into public.teams (event_id, name, category, presentation_order, status, active)
select
  '00000000-0000-4000-8000-000000000100',
  null,
  case when slot <= 10 then 'STARTUP'::public.team_category else 'BUSINESS_ANALYSIS'::public.team_category end,
  slot,
  'WAITING'::public.team_status,
  true
from generate_series(1, 19) as slot
where not exists (
  select 1 from public.teams team
  where team.event_id = '00000000-0000-4000-8000-000000000100'
    and team.presentation_order = slot
);
