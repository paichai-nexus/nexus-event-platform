begin;
create function public.import_team_roster(p_event_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare selected_event public.events%rowtype; row_count integer; startup_count integer; analysis_count integer;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) <> 19 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  select * into selected_event from public.events where id = p_event_id for update;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.status::text in ('FINALIZED', 'ENDED') then raise exception 'EVENT_CLOSED'; end if;
  if (select count(*) from public.teams where event_id = p_event_id) <> 19 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  select count(*), count(*) filter (where category = 'STARTUP'), count(*) filter (where category = 'BUSINESS_ANALYSIS')
    into row_count, startup_count, analysis_count
  from jsonb_to_recordset(p_rows) as row_data("order" integer, category text, name text, department text, "leaderName" text, "memberNames" jsonb, "advisorName" text, topic text, active boolean);
  if row_count <> 19 or startup_count <> 10 or analysis_count <> 9 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  if (select count(distinct (item->>'order')::integer) from jsonb_array_elements(p_rows) item) <> 19
    or (select count(distinct lower(trim(item->>'name'))) from jsonb_array_elements(p_rows) item) <> 19 then raise exception 'TEAM_ROSTER_INVALID'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) item where (item->>'order')::integer not between 1 and 19
    or length(trim(coalesce(item->>'name',''))) = 0 or length(trim(coalesce(item->>'department',''))) = 0
    or length(trim(coalesce(item->>'leaderName',''))) = 0 or length(trim(coalesce(item->>'advisorName',''))) = 0
    or length(trim(coalesce(item->>'topic',''))) = 0 or jsonb_typeof(item->'memberNames') <> 'array' or jsonb_array_length(item->'memberNames') = 0) then raise exception 'TEAM_ROSTER_INVALID'; end if;
  update public.teams team set name = source.name, department = source.department, leader_name = source."leaderName",
    member_names = array(select jsonb_array_elements_text(source."memberNames")), advisor_name = source."advisorName",
    presentation_topic = source.topic, category = source.category::public.team_category, active = source.active,
    promotion_enabled = true, status = 'WAITING'::public.team_status
  from jsonb_to_recordset(p_rows) as source("order" integer, category text, name text, department text, "leaderName" text, "memberNames" jsonb, "advisorName" text, topic text, active boolean)
  where team.event_id = p_event_id and team.presentation_order = source."order";
  if not found then raise exception 'TEAM_ROSTER_INVALID'; end if;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'TEAM_ROSTER_IMPORT', 'event', p_event_id, jsonb_build_object('team_count', 19, 'startup_count', 10, 'analysis_count', 9));
end;
$$;
revoke all on function public.import_team_roster(uuid, jsonb) from public;
grant execute on function public.import_team_roster(uuid, jsonb) to authenticated;
commit;
