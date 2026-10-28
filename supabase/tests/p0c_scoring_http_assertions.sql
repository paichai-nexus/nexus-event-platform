\set ON_ERROR_STOP on

begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
set local role authenticated;

do $$
declare
  event_a constant uuid := '00000000-0000-4000-8000-000000000100';
  event_b constant uuid := '00000000-0000-4000-8000-000000000110';
begin
  if (select sum(vote_count) from public.get_audience_vote_snapshot(event_a)) <> 3 then
    raise exception 'ASSERTION_FAILED: event A vote snapshot must contain exactly 3 votes';
  end if;
  if (select sum(vote_count) from public.get_audience_vote_snapshot(event_b)) <> 1 then
    raise exception 'ASSERTION_FAILED: event B vote snapshot must contain exactly 1 vote';
  end if;
  if exists (select 1 from public.result_snapshots where event_id in (event_a, event_b)) then
    raise exception 'ASSERTION_FAILED: diagnostics created an official result snapshot';
  end if;
  if exists (select 1 from public.events where id in (event_a, event_b) and result_status <> 'LOCKED') then
    raise exception 'ASSERTION_FAILED: diagnostics changed result lock state';
  end if;
end;
$$;

select 'PASS: scoring diagnostics remained read-only and vote snapshots stayed event-scoped.' as result;
commit;
