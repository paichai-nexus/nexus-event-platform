-- Compatibility fixture: represents data that may already exist before 011/012.
insert into public.participants (
  id, event_id, participant_code, display_label, access_token_hash, active
) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000100',
  'LEGACY-001', 'Legacy audience', repeat('a', 64), true
) on conflict do nothing;

insert into public.audience_attendance_sessions (
  id, event_id, session_token_hash, participant_label, entered_at
) values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000100',
  repeat('a', 64), 'Legacy audience', now() - interval '10 minutes'
) on conflict do nothing;

insert into public.audience_submissions (
  id, event_id, participant_id, team_id, submitted_at
) select
  '30000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000100',
  '10000000-0000-4000-8000-000000000001',
  id,
  now() - interval '5 minutes'
from public.teams where event_id = '00000000-0000-4000-8000-000000000100'
order by presentation_order limit 1
on conflict do nothing;
