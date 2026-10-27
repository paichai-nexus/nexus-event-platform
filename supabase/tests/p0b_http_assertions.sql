\set ON_ERROR_STOP on

do $$
declare
  event_uuid constant uuid := '00000000-0000-4000-8000-000000000100';
begin
  if (select count(*) from public.audience_attendance_sessions where event_id = event_uuid and exited_at is null) <> 12 then
    raise exception 'ASSERTION_FAILED: expected 12 active audience attendance sessions';
  end if;
  if (select count(*) from public.audience_submissions where event_id = event_uuid) <> 12 then
    raise exception 'ASSERTION_FAILED: expected exactly 12 persistent audience submissions';
  end if;
  if (select count(*) from public.judge_submissions where event_id = event_uuid and status = 'SUBMITTED') <> 3 then
    raise exception 'ASSERTION_FAILED: expected 3 submitted judge records';
  end if;
  if not exists (select 1 from public.judge_score_revisions where revision >= 1) then
    raise exception 'ASSERTION_FAILED: judge score revision was not preserved after unlock';
  end if;
  if exists (select 1 from public.participants where event_id = event_uuid and participant_code like 'TEST-%') then
    raise exception 'ASSERTION_FAILED: migration mock participants leaked into P0-B HTTP dataset';
  end if;
end;
$$;

select 'PASS: 12 audience, 3 judges, duplicate protection, and revision preservation verified.' as result;
