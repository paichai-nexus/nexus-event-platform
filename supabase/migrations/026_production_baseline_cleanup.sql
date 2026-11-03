-- Remove only the deterministic rehearsal participants created by
-- 005_rehearsal_seed.sql. Real registrations, attendance, votes and scores are
-- never matched by this predicate. Foreign-key restrictions intentionally make
-- this migration fail closed if a rehearsal participant has acquired records.

delete from public.participants
where event_id = '00000000-0000-4000-8000-000000000100'
  and affiliation = 'REHEARSAL'
  and participant_code ~ '^TEST-[0-9]{3}$'
  and display_label = 'Participant ' || participant_code;

do $$
begin
  if exists (
    select 1
    from public.participants
    where event_id = '00000000-0000-4000-8000-000000000100'
      and affiliation = 'REHEARSAL'
      and participant_code ~ '^TEST-[0-9]{3}$'
  ) then
    raise exception 'REHEARSAL_PARTICIPANT_CLEANUP_INCOMPLETE';
  end if;
end;
$$;
