begin;

alter table public.events drop constraint if exists events_display_mode_check;
alter table public.events add constraint events_display_mode_check
  check (display_mode in ('SPOTLIGHT', 'VOTE_PROGRESS', 'HOLDING', 'RESULT_SHOW', 'AWARD_REVEAL'));

create table public.result_show_decks (
  event_id uuid primary key references public.events(id) on delete cascade,
  judge_comment text not null default '' check (char_length(judge_comment) <= 2000),
  awards jsonb not null default '[]'::jsonb check (jsonb_typeof(awards) = 'array' and jsonb_array_length(awards) <= 20),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED')),
  current_scene text not null default 'REVIEW' check (current_scene in ('REVIEW', 'RESULT')),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint result_show_approval_state check ((status = 'DRAFT' and approved_by is null and approved_at is null) or (status = 'APPROVED' and approved_by is not null and approved_at is not null))
);

alter table public.result_show_decks enable row level security;
create policy result_show_staff_read on public.result_show_decks for select to authenticated using (public.current_app_role() in ('ADMIN', 'STAFF'));
create policy result_show_staff_insert on public.result_show_decks for insert to authenticated with check (public.current_app_role() in ('ADMIN', 'STAFF') and status = 'DRAFT');
create policy result_show_staff_draft_update on public.result_show_decks for update to authenticated
  using (public.current_app_role() in ('ADMIN', 'STAFF') and status = 'DRAFT')
  with check (public.current_app_role() in ('ADMIN', 'STAFF') and status = 'DRAFT');

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
  values (p_event_id, auth.uid(), 'RESULT_SHOW_APPROVE', 'event', p_event_id, jsonb_build_object('award_count', jsonb_array_length(saved.awards)));
  return saved;
end;
$$;

create or replace function public.set_result_show_scene(p_event_id uuid, p_scene text)
returns public.result_show_decks language plpgsql security definer set search_path = public as $$
declare saved public.result_show_decks%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  if p_scene not in ('REVIEW', 'RESULT') then raise exception 'INVALID_SHOW_SCENE'; end if;
  update public.result_show_decks set current_scene = p_scene, updated_at = now()
    where event_id = p_event_id and status = 'APPROVED' returning * into saved;
  if saved.event_id is null then raise exception 'SHOW_DECK_NOT_APPROVED'; end if;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'RESULT_SHOW_SCENE', 'event', p_event_id, jsonb_build_object('scene', p_scene));
  return saved;
end;
$$;

create or replace function public.set_event_display_mode(p_event_id uuid, p_display_mode text)
returns public.events language plpgsql security definer set search_path = public as $$
declare v_event public.events%rowtype;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  if p_display_mode not in ('SPOTLIGHT', 'VOTE_PROGRESS', 'HOLDING', 'RESULT_SHOW', 'AWARD_REVEAL') then raise exception 'INVALID_DISPLAY_MODE'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if p_display_mode = 'RESULT_SHOW' and not exists (select 1 from public.result_show_decks where event_id = p_event_id and status = 'APPROVED') then raise exception 'SHOW_DECK_NOT_APPROVED'; end if;
  if p_display_mode = 'AWARD_REVEAL' and v_event.result_status = 'LOCKED' then raise exception 'RESULT_LOCKED'; end if;
  update public.events set display_mode = p_display_mode where id = p_event_id returning * into v_event;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'DISPLAY_MODE_CHANGE', 'event', p_event_id, jsonb_build_object('display_mode', p_display_mode));
  return v_event;
end;
$$;

revoke all on public.result_show_decks from anon, authenticated;
grant select, insert, update on public.result_show_decks to authenticated;
grant select on public.result_show_decks to service_role;
revoke all on function public.approve_result_show_deck(uuid), public.set_result_show_scene(uuid, text) from public;
grant execute on function public.approve_result_show_deck(uuid), public.set_result_show_scene(uuid, text) to authenticated;

commit;
