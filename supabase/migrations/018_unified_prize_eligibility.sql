-- 018: unify on-site audience evaluation group and general spectator prize eligibility.
-- IMPORTANT: deploy only after reviewing the event policy; this does not touch existing draw records.
-- Voting registration alone does NOT qualify. Only checked-in general attendees
-- or ACTIVE on-site audience attendance sessions are eligible.
-- An audience session is matched to a participant by token hash, sharing the same
-- participant as a previously registered audience voter when possible.
-- Credentials are never exposed to the draw caller.
create or replace function public.draw_prize_winner(p_event_id uuid)
returns table (draw_id uuid, round integer, participant_id uuid, participant_code text, drawn_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_participant public.participants%rowtype;
  v_draw public.prize_draws%rowtype;
  v_round integer;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  -- Serializes draws (and audience participant creation) for this event.
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  -- Create participant records for physically entered audience sessions only.
  -- Reuse existing registered voter participant when the same token hash matches.
  insert into public.participants
    (event_id, participant_code, display_label, access_token_hash, active)
  select a.event_id, 'AUD-' || upper(substr(a.session_token_hash, 1, 16)),
         a.participant_label, a.session_token_hash, true
  from public.audience_attendance_sessions a
  where a.event_id = p_event_id and a.exited_at is null
    and not exists (
      select 1 from public.participants p
      where p.event_id = a.event_id and p.access_token_hash = a.session_token_hash
    )
  on conflict (event_id, access_token_hash) do nothing;

  -- Same participant never appears twice even when both check-in routes were used.
  select p.* into v_participant
  from public.participants p
  where p.event_id = p_event_id and p.active
    and (
      exists (select 1 from public.check_ins c
              where c.event_id = p_event_id and c.participant_id = p.id)
      or exists (select 1 from public.audience_attendance_sessions a
                 where a.event_id = p_event_id and a.exited_at is null
                   and a.session_token_hash = p.access_token_hash)
    )
    and not exists (
      select 1 from public.prize_draws d
      where d.event_id = p_event_id and d.participant_id = p.id
        and d.status = 'ACTIVE'
    )
  order by gen_random_uuid()
  limit 1
  for update of p;

  if v_participant.id is null then raise exception 'NO_ELIGIBLE_PARTICIPANT'; end if;
  select coalesce(max(d.round), 0) + 1 into v_round
    from public.prize_draws d where d.event_id = p_event_id;

  insert into public.prize_draws(event_id, round, participant_id, drawn_by)
    values (p_event_id, v_round, v_participant.id, auth.uid())
    returning * into v_draw;
  insert into public.audit_logs(event_id, actor_user_id, action, target_type, target_id, metadata)
    values (p_event_id, auth.uid(), 'PRIZE_DRAW', 'prize_draw', v_draw.id,
      jsonb_build_object('participant_id', v_participant.id, 'round', v_round,
                         'eligibility_source', 'CHECK_IN_OR_ACTIVE_AUDIENCE'));
  return query select v_draw.id, v_draw.round, v_participant.id,
                      v_participant.participant_code, v_draw.drawn_at;
end;
$$;

revoke all on function public.draw_prize_winner(uuid) from public;
grant execute on function public.draw_prize_winner(uuid) to authenticated;
