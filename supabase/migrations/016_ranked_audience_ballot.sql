-- PCU credential registration and 4-pick ranked ballot, separate from physical attendance.
-- Requires 015. Existing participant/vote/check-in rows are preserved.
-- IMPORTANT: PCU-101..PCU-220 are sequential public codes, not cryptographic secrets.
-- Issue only physically and monitor duplicates; a code alone is not strong person authentication.

alter table public.audience_vote_registrations
  add column if not exists department text,
  add column if not exists student_number text,
  add column if not exists full_name text,
  add column if not exists pcu_code text;
create unique index audience_registration_unique_student
  on public.audience_vote_registrations(event_id, student_number)
  where student_number is not null;
create unique index audience_registration_unique_code
  on public.audience_vote_registrations(event_id, pcu_code)
  where pcu_code is not null;

-- Legacy registrations do not automatically qualify for this new PCU-based ballot.
-- Restrict the empty-body API from 015 and revoke its underlying function.
revoke execute on function public.register_audience_voter(uuid, text) from service_role;

create table public.audience_ranked_ballots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.audience_vote_registrations(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  unique(event_id, registration_id)
);
create table public.audience_ranked_choices (
  ballot_id uuid not null references public.audience_ranked_ballots(id) on delete restrict,
  category public.team_category not null,
  rank smallint not null check (rank in (1,2)),
  team_id uuid not null references public.teams(id) on delete restrict,
  primary key(ballot_id, category, rank),
  unique(ballot_id, team_id)
);
create index audience_ranked_ballots_event_idx on public.audience_ranked_ballots(event_id);
alter table public.audience_ranked_ballots enable row level security;
alter table public.audience_ranked_choices enable row level security;
revoke all on public.audience_ranked_ballots, public.audience_ranked_choices from anon, authenticated;

grant select, insert on public.audience_ranked_ballots, public.audience_ranked_choices to service_role;


-- Register with field-level validation, a 120-code whitelist and DB uniqueness guards.
-- This is a single DB transaction, so all uniqueness violations roll back.
create function public.register_pcu_audience_voter(
 p_event_id uuid, p_session_token text, p_department text,
 p_student_number text, p_full_name text, p_pcu_code text
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
 e_id uuid; token_hash text; participant uuid; normalized_code text;
begin
 if length(p_session_token) < 16 then raise exception 'INVALID_SESSION'; end if;
 if length(btrim(coalesce(p_department,''))) not between 2 and 80
    or length(btrim(coalesce(p_full_name,''))) not between 2 and 40
    or coalesce(p_student_number,'') !~ '^[0-9]{5,12}$' then raise exception 'INVALID_PROFILE'; end if;
 normalized_code := upper(btrim(coalesce(p_pcu_code,'')));
 if normalized_code !~ '^PCU-(10[1-9]|1[1-9][0-9]|2[01][0-9]|220)$' then
   raise exception 'INVALID_PCU_CODE';
 end if;
 e_id := public.resolve_attendance_event(p_event_id);
 if e_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
 token_hash := encode(digest(p_session_token, 'sha256'), 'hex');
 -- Stable browser token may previously have been used by legacy check-in/015 registration.
 insert into public.participants(event_id, participant_code, display_label, access_token_hash, active)
 values(e_id, 'PCU-'||token_hash, btrim(p_full_name), token_hash, true)
 on conflict(event_id, access_token_hash) do update set access_token_hash=excluded.access_token_hash
 returning id into participant;
 -- Idempotent retry for the same identity/code, reject inconsistent changes.
 if exists(select 1 from public.audience_vote_registrations
           where event_id=e_id and session_token_hash=token_hash) then
   if exists(select 1 from public.audience_vote_registrations
             where event_id=e_id and session_token_hash=token_hash
               and student_number=p_student_number and pcu_code=normalized_code
               and full_name=btrim(p_full_name) and department=btrim(p_department)) then
     return true;
   end if;
   -- A 015 legacy registration can be upgraded once with full identity.
   if exists(select 1 from public.audience_vote_registrations
             where event_id=e_id and session_token_hash=token_hash and student_number is null) then
      update public.audience_vote_registrations set
        student_number=p_student_number, pcu_code=normalized_code,
        full_name=btrim(p_full_name), department=btrim(p_department)
      where event_id=e_id and session_token_hash=token_hash;
      return true;
   end if;
   raise exception 'ALREADY_REGISTERED';
 end if;
 insert into public.audience_vote_registrations(
   event_id,participant_id,session_token_hash,student_number,pcu_code,full_name,department)
 values(e_id,participant,token_hash,p_student_number,normalized_code,btrim(p_full_name),btrim(p_department));
 return true;
exception when unique_violation then
 raise exception 'CODE_OR_STUDENT_ALREADY_USED';
end;
$$;

create function public.get_pcu_ballot_state(p_event_id uuid,p_session_token text)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare
 e_id uuid; reg_id uuid; ballot_uuid uuid; status_value public.voting_status;
 votes jsonb;
begin
 if length(p_session_token)<16 then raise exception 'INVALID_SESSION'; end if;
 e_id:=public.resolve_attendance_event(p_event_id);
 if e_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
 select voting_status into status_value from public.events where id=e_id;
 select id into reg_id from public.audience_vote_registrations
 where event_id=e_id and session_token_hash=encode(digest(p_session_token,'sha256'),'hex')
   and pcu_code is not null;
 select id into ballot_uuid from public.audience_ranked_ballots
 where event_id=e_id and registration_id=reg_id;
 select coalesce(jsonb_agg(jsonb_build_object('category',category,'rank',rank,'teamId',team_id)
   order by category,rank),'[]'::jsonb) into votes
 from public.audience_ranked_choices where ballot_id=ballot_uuid;
 return jsonb_build_object('registered',reg_id is not null,'submitted',ballot_uuid is not null,
   'votingStatus',status_value,'choices',votes);
end;
$$;

create function public.submit_pcu_ranked_ballot(p_event_id uuid,p_session_token text,p_choices jsonb)
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
 perform 1 from public.events where id=e_id and voting_status='OPEN' for share;
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

revoke all on function public.register_pcu_audience_voter(uuid,text,text,text,text,text) from public;
revoke all on function public.get_pcu_ballot_state(uuid,text) from public;
revoke all on function public.submit_pcu_ranked_ballot(uuid,text,jsonb) from public;
grant execute on function public.register_pcu_audience_voter(uuid,text,text,text,text,text) to service_role;
grant execute on function public.get_pcu_ballot_state(uuid,text) to service_role;
grant execute on function public.submit_pcu_ranked_ballot(uuid,text,jsonb) to service_role;


create function public.get_pcu_ranked_tally(p_event_id uuid)
returns table(category public.team_category, team_id uuid, first_votes bigint, second_votes bigint, total_ballots bigint)
language sql security definer set search_path = public, extensions as $$
 select choice.category, choice.team_id,
 count(*) filter (where choice.rank=1) as first_votes,
 count(*) filter (where choice.rank=2) as second_votes,
 (select count(*) from public.audience_ranked_ballots where event_id=p_event_id) as total_ballots
 from public.audience_ranked_choices choice
 join public.audience_ranked_ballots ballot on ballot.id=choice.ballot_id
 where ballot.event_id=p_event_id
 group by choice.category, choice.team_id;
$$;
revoke all on function public.get_pcu_ranked_tally(uuid) from public;
grant execute on function public.get_pcu_ranked_tally(uuid) to service_role;
