create index participants_event_active_idx on public.participants (event_id, active);
create index teams_event_active_order_idx on public.teams (event_id, active, presentation_order);
create index teams_event_status_idx on public.teams (event_id, status);
create unique index teams_one_presenting_per_event_idx on public.teams (event_id)
  where status = 'PRESENTING';
create index check_ins_event_time_idx on public.check_ins (event_id, checked_in_at desc);
create index audience_submissions_event_team_idx on public.audience_submissions (event_id, team_id);
create index audience_submissions_event_time_idx on public.audience_submissions (event_id, submitted_at desc);
create index judge_assignments_user_event_idx on public.judge_assignments (judge_user_id, event_id, active);
create index judge_submissions_event_status_idx on public.judge_submissions (event_id, status);
create index result_snapshots_event_time_idx on public.result_snapshots (event_id, finalized_at desc);
create index prize_draws_event_status_idx on public.prize_draws (event_id, status, drawn_at desc);
create index audit_logs_event_time_idx on public.audit_logs (event_id, created_at desc);
