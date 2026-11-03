begin;

-- Hosted Supabase projects may disable automatic Data API grants. RLS still
-- decides which rows are visible; these grants only allow the authenticated
-- role to reach the operations already covered by the policies in 003_rls.
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, update on public.events to authenticated;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select on public.check_ins to authenticated;
grant select, insert, update, delete on public.evaluation_criteria to authenticated;
grant select on public.audience_submissions, public.audience_scores to authenticated;
grant select, insert, update, delete on public.judge_assignments to authenticated;
grant select, insert, update on public.judge_submissions to authenticated;
grant select, insert, update, delete on public.judge_scores to authenticated;
grant select on public.result_snapshots, public.prize_draws, public.audit_logs to authenticated;

commit;
