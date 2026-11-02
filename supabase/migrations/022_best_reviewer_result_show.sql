begin;

alter table public.result_show_decks
  add column if not exists best_reviewer jsonb;

alter table public.result_show_decks
  add constraint result_show_best_reviewer_object
  check (best_reviewer is null or (
    jsonb_typeof(best_reviewer) = 'object'
    and length(trim(coalesce(best_reviewer->>'participantCode', ''))) between 1 and 30
    and length(trim(coalesce(best_reviewer->>'name', ''))) between 1 and 100
    and length(trim(coalesce(best_reviewer->>'department', ''))) between 1 and 100
    and length(trim(coalesce(best_reviewer->>'reviewExcerpt', ''))) between 1 and 500
  ));

alter table public.result_show_decks drop constraint if exists result_show_decks_current_scene_check;
alter table public.result_show_decks add constraint result_show_decks_current_scene_check
  check (current_scene in ('REVIEW', 'RESULT', 'BEST_REVIEWER'));

create or replace function public.approve_result_show_deck(p_event_id uuid)
returns public.result_show_decks language plpgsql security definer set search_path = public as $$
declare saved public.result_show_decks%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  select * into saved from public.result_show_decks where event_id = p_event_id for update;
  if saved.event_id is null then raise exception 'SHOW_DECK_NOT_FOUND'; end if;
  if length(trim(saved.judge_comment)) = 0 or jsonb_array_length(saved.awards) = 0 then raise exception 'SHOW_DECK_INCOMPLETE'; end if;
  update public.result_show_decks set status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), updated_at = now()
    where event_id = p_event_id returning * into saved;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'RESULT_SHOW_APPROVE', 'event', p_event_id,
    jsonb_build_object('award_count', jsonb_array_length(saved.awards), 'best_reviewer_included', saved.best_reviewer is not null));
  return saved;
end;
$$;

create or replace function public.set_result_show_scene(p_event_id uuid, p_scene text)
returns public.result_show_decks language plpgsql security definer set search_path = public as $$
declare saved public.result_show_decks%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  if p_scene not in ('REVIEW', 'RESULT', 'BEST_REVIEWER') then raise exception 'INVALID_SHOW_SCENE'; end if;
  if p_scene = 'BEST_REVIEWER' and not exists (
    select 1 from public.result_show_decks where event_id = p_event_id and status = 'APPROVED' and best_reviewer is not null
  ) then raise exception 'BEST_REVIEWER_NOT_APPROVED'; end if;
  update public.result_show_decks set current_scene = p_scene, updated_at = now()
    where event_id = p_event_id and status = 'APPROVED' returning * into saved;
  if saved.event_id is null then raise exception 'SHOW_DECK_NOT_APPROVED'; end if;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'RESULT_SHOW_SCENE', 'event', p_event_id, jsonb_build_object('scene', p_scene));
  return saved;
end;
$$;

revoke all on function public.approve_result_show_deck(uuid), public.set_result_show_scene(uuid, text) from public;
grant execute on function public.approve_result_show_deck(uuid), public.set_result_show_scene(uuid, text) to authenticated;

commit;
