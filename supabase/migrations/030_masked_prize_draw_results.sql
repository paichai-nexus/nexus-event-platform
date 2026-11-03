begin;

create or replace function public.get_prize_draw_results(p_event_id uuid)
returns table (
  draw_id uuid,
  prize_item_id uuid,
  prize_name text,
  pool public.prize_eligibility_pool,
  round integer,
  participant_code text,
  department text,
  masked_student_number text,
  masked_name text,
  drawn_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    draw.id,
    prize.id,
    prize.name,
    prize.pool,
    draw.round,
    participant.participant_code,
    identity.department,
    left(identity.student_number, least(4, char_length(identity.student_number)))
      || repeat('*', least(6, greatest(char_length(identity.student_number) - 4, 1))),
    case
      when char_length(identity.attendee_name) <= 1 then left(identity.attendee_name, 1) || '*'
      when char_length(identity.attendee_name) = 2 then left(identity.attendee_name, 1) || '*'
      else left(identity.attendee_name, 1)
        || repeat('*', greatest(char_length(identity.attendee_name) - 2, 1))
        || right(identity.attendee_name, 1)
    end,
    draw.drawn_at
  from public.prize_item_draws draw
  join public.prize_inventory prize
    on prize.id = draw.prize_item_id and prize.event_id = draw.event_id
  join public.participants participant
    on participant.id = draw.participant_id and participant.event_id = draw.event_id
  join lateral (
    select entry.department, entry.student_number, entry.attendee_name
    from public.part_attendance_entries entry
    where entry.event_id = draw.event_id and entry.participant_id = draw.participant_id
    order by entry.part desc, entry.submitted_at desc
    limit 1
  ) identity on true
  where draw.event_id = p_event_id and draw.status = 'ACTIVE'
  order by draw.drawn_at desc, draw.id desc;
end;
$$;

revoke all on function public.get_prize_draw_results(uuid) from public;
grant execute on function public.get_prize_draw_results(uuid) to authenticated;

comment on function public.get_prize_draw_results(uuid) is
  'ADMIN/STAFF-only prize results. Returns only masked student numbers and names for projector display.';

commit;
