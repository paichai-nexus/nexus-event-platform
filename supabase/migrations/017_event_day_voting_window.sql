-- 017: Vote is permitted only after 17:00 Asia/Seoul on the event day
-- AND only when an operator opens the vote. Google Form collection is a separate process.
-- No existing attendance, participant, registration or ballot data is deleted.
alter table public.events
  add column if not exists ranked_voting_opens_at timestamptz;

-- This date is explicit: do not silently schedule unrelated rehearsal events.
update public.events
set ranked_voting_opens_at = '2026-11-04 17:00:00+09'::timestamptz
where (starts_at at time zone 'Asia/Seoul')::date = date '2026-11-04'
  and ranked_voting_opens_at is null;

create or replace function public.submit_pcu_ranked_ballot(p_event_id uuid,p_session_token text,p_choices jsonb)
returns uuid language plpgsql security definer set search_path=public, extensions as $$
declare
 e_id uuid; reg_id uuid; ballot_uuid uuid; item jsonb; n integer;
 team_uuid uuid; team_category public.team_category; rank_num integer;
begin
 if length(p_session_token)<16 then raise exception 'INVALID_SESSION'; end if;
 if jsonb_typeof(p_choices) is distinct from 'array' or jsonb_array_length(p_choices) <> 4 then
    raise exception 'INVALID_BALLOT'; end if;
 e_id:=public.resolve_attendance_event(p_event_id);
 if e_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
 -- Serialize against admin state changes and concurrent submissions.
 perform 1 from public.events
 where id=e_id and voting_status='OPEN'
   and ranked_voting_opens_at is not null
   and now() >= ranked_voting_opens_at
 for share;
 if not found then raise exception 'VOTING_CLOSED'; end if;
 select id into reg_id from public.audience_vote_registrations
 where event_id=e_id and session_token_hash=encode(digest(p_session_token,'sha256'),'hex')
  and pcu_code is not null;
 if reg_id is null then raise exception 'NOT_ELIGIBLE'; end if;
 if exists(select 1 from public.audience_ranked_ballots where event_id=e_id and registration_id=reg_id) then
    raise exception 'ALREADY_SUBMITTED'; end if;
 -- Check both rankings per category, and four distinct active teams.
 insert into public.audience_ranked_ballots(event_id,registration_id)
 values(e_id,reg_id) returning id into ballot_uuid;
 for item in select value from jsonb_array_elements(p_choices) loop
   if (item->>'category') not in ('STARTUP','BUSINESS_ANALYSIS') or (item->>'rank') not in ('1','2') then
      raise exception 'INVALID_BALLOT'; end if;
   team_category:=(item->>'category')::public.team_category;
   rank_num:=(item->>'rank')::integer;
   team_uuid:=(item->>'teamId')::uuid;
   if not exists(select 1 from public.teams where id=team_uuid and event_id=e_id
                 and category=team_category and active=true) then raise exception 'INVALID_TEAM'; end if;
   insert into public.audience_ranked_choices(ballot_id,category,rank,team_id)
   values(ballot_uuid,team_category,rank_num,team_uuid);
 end loop;
 select count(*) into n from public.audience_ranked_choices where ballot_id=ballot_uuid;
 if n<>4 or (select count(distinct category) from public.audience_ranked_choices where ballot_id=ballot_uuid)<>2 then
   raise exception 'INVALID_BALLOT'; end if;
 return ballot_uuid;
exception when unique_violation then
 raise exception 'ALREADY_SUBMITTED_OR_DUPLICATE_CHOICE';
end;
$$;

revoke all on function public.submit_pcu_ranked_ballot(uuid,text,jsonb) from public;
grant execute on function public.submit_pcu_ranked_ballot(uuid,text,jsonb) to service_role;
