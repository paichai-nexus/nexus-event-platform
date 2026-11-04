-- Event-day rehearsal attendee reset, limited to the identified event.
-- Review before using in the Supabase production project.
-- Does NOT auto-run. This only installs a secure RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.reset_event_day_test_attendees(
  p_event_id uuid,
  p_expected_attendance_count integer,
  p_expected_pcu_count integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  selected_event public.events%rowtype;
  attendance_count integer;
  pcu_count integer;
  affected_participants uuid[];
  removed_attendance integer;
  removed_pcu integer;
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'ADMIN'::public.app_role THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO selected_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF selected_event.id IS NULL THEN RAISE EXCEPTION 'EVENT_NOT_FOUND'; END IF;
  IF selected_event.mode::text <> 'REHEARSAL' OR
     selected_event.status::text IN ('FINALIZED','ENDED') OR
     selected_event.result_status::text <> 'LOCKED' THEN
    RAISE EXCEPTION 'LIVE_OR_FINALIZED_RESET_FORBIDDEN';
  END IF;
  -- Fail closed if operational work has begun. The reset is *only* for attendee rehearsal.
  IF EXISTS (SELECT 1 FROM public.audience_rank_ballots WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.paper_judge_scores WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.prize_item_draws WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.prize_draws WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.prize_stage_snapshots WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.check_ins WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.audience_submissions WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.judge_submissions WHERE event_id = p_event_id)
    OR EXISTS (SELECT 1 FROM public.result_snapshots WHERE event_id = p_event_id) THEN
    RAISE EXCEPTION 'OPERATIONAL_DATA_EXISTS_RESET_FORBIDDEN';
  END IF;
  SELECT COUNT(*) INTO attendance_count FROM public.part_attendance_entries WHERE event_id = p_event_id;
  SELECT COUNT(*) INTO pcu_count FROM public.audience_jury_reservations WHERE event_id = p_event_id AND pcu_code IS NOT NULL;
  IF attendance_count IS DISTINCT FROM p_expected_attendance_count OR
     pcu_count IS DISTINCT FROM p_expected_pcu_count THEN
    RAISE EXCEPTION 'COUNT_CHANGED_REFRESH_REQUIRED';
  END IF;
  SELECT array_agg(DISTINCT participant_id) INTO affected_participants
  FROM public.part_attendance_entries WHERE event_id = p_event_id;
  DELETE FROM public.audience_jury_reservations WHERE event_id = p_event_id;
  GET DIAGNOSTICS removed_pcu = ROW_COUNT;
  DELETE FROM public.part_attendance_entries WHERE event_id = p_event_id;
  GET DIAGNOSTICS removed_attendance = ROW_COUNT;
  -- Attendance-created ENT participants are kept for referential integrity,
  -- but deactivated so they cannot be selected as live entrants.
  UPDATE public.participants SET active = false
    WHERE event_id = p_event_id AND id = ANY(coalesce(affected_participants, ARRAY[]::uuid[]))
      AND participant_code LIKE 'ENT-%';
  INSERT INTO public.audit_logs(event_id, actor_user_id, action, target_type, target_id, metadata)
    VALUES (p_event_id, auth.uid(), 'EVENT_DAY_TEST_ATTENDEES_RESET', 'event', p_event_id,
      jsonb_build_object('part_attendance_deleted',removed_attendance,'pcu_rows_deleted',removed_pcu));
  RETURN jsonb_build_object('attendanceDeleted',removed_attendance,'juryRowsDeleted',removed_pcu);
END;
$$;
REVOKE ALL ON FUNCTION public.reset_event_day_test_attendees(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_event_day_test_attendees(uuid,integer,integer) TO authenticated;
COMMIT;
