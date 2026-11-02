begin;
create table public.ceremony_control_states (
  event_id uuid primary key references public.events(id) on delete cascade,
  phase text not null check (phase in ('AUDIENCE_CANDIDATES','SECOND_DRAW','JUDGE_REVIEW','RESULTS','BEST_REVIEWER','THIRD_DRAW','COMPLETE')),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
alter table public.ceremony_control_states enable row level security;
create policy ceremony_control_staff_read on public.ceremony_control_states for select to authenticated using (public.current_app_role() in ('ADMIN','STAFF'));
revoke all on public.ceremony_control_states from anon, authenticated;
grant select on public.ceremony_control_states to authenticated;

create function public.advance_ceremony_phase(p_event_id uuid, p_phase text)
returns public.ceremony_control_states language plpgsql security definer set search_path = public as $$
declare saved public.ceremony_control_states%rowtype; current_index integer; next_index integer;
  phases text[] := array['AUDIENCE_CANDIDATES','SECOND_DRAW','JUDGE_REVIEW','RESULTS','BEST_REVIEWER','THIRD_DRAW','COMPLETE'];
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  next_index := array_position(phases, p_phase);
  if next_index is null then raise exception 'CEREMONY_INVALID_PHASE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':CEREMONY', 0));
  select * into saved from public.ceremony_control_states where event_id = p_event_id for update;
  if saved.event_id is null then
    if p_phase <> 'AUDIENCE_CANDIDATES' then raise exception 'CEREMONY_INVALID_TRANSITION'; end if;
    insert into public.ceremony_control_states (event_id, phase, updated_by) values (p_event_id, p_phase, auth.uid()) returning * into saved;
  else
    current_index := array_position(phases, saved.phase);
    if next_index < current_index or next_index > current_index + 1 then raise exception 'CEREMONY_INVALID_TRANSITION'; end if;
    update public.ceremony_control_states set phase = p_phase, updated_by = auth.uid(), updated_at = now() where event_id = p_event_id returning * into saved;
  end if;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'CEREMONY_PHASE_CHANGE', 'event', p_event_id, jsonb_build_object('phase', p_phase));
  return saved;
end;
$$;
revoke all on function public.advance_ceremony_phase(uuid, text) from public;
grant execute on function public.advance_ceremony_phase(uuid, text) to authenticated;
commit;
