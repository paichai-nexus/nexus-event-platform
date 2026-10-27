insert into public.events (
  id, name, starts_at, ends_at, venue, mode, status, voting_status
) values (
  '00000000-0000-4000-8000-000000000100',
  '제24회 배재대학교 경영대학 학술제',
  '2026-11-04 13:00:00+09',
  '2026-11-04 18:00:00+09',
  '배재대학교 21세기관',
  'REHEARSAL',
  'CHECK_IN_OPEN',
  'READY'
) on conflict (id) do nothing;

insert into public.participants (event_id, participant_code, display_label, affiliation)
select
  '00000000-0000-4000-8000-000000000100',
  'TEST-' || lpad(series::text, 3, '0'),
  'Participant TEST-' || lpad(series::text, 3, '0'),
  'REHEARSAL'
from generate_series(1, 10) as series
on conflict (event_id, participant_code) do nothing;

insert into public.teams (event_id, name, category, presentation_order, status)
values
  ('00000000-0000-4000-8000-000000000100', 'TEAM 01', 'STARTUP', 1, 'DONE'),
  ('00000000-0000-4000-8000-000000000100', 'TEAM 02', 'STARTUP', 2, 'PRESENTING'),
  ('00000000-0000-4000-8000-000000000100', 'TEAM 03', 'BUSINESS_ANALYSIS', 3, 'WAITING'),
  ('00000000-0000-4000-8000-000000000100', 'TEAM 04', 'BUSINESS_ANALYSIS', 4, 'WAITING')
on conflict (event_id, name) do nothing;

-- Evaluation criteria are intentionally not seeded. Official criteria and allocations are RULE_NOT_CONFIRMED.
