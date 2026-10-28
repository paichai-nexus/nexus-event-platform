\set ON_ERROR_STOP on
begin transaction read only;
set local statement_timeout = '15s';

select json_build_object(
  'migrations', (
    select coalesce(json_agg(version order by version), '[]'::json)
    from supabase_migrations.schema_migrations
  ),
  'rls', (
    select json_object_agg(class.relname, class.relrowsecurity order by class.relname)
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = any(array[
        'events', 'profiles', 'participants', 'teams', 'check_ins',
        'audience_attendance_sessions', 'audience_submissions', 'audience_scores',
        'judge_assignments', 'judge_submissions', 'judge_scores',
        'judge_score_revisions', 'result_snapshots', 'audit_logs'
      ])
  ),
  'privileges', json_build_object(
    'anon_events_select', has_table_privilege('anon', 'public.events', 'SELECT'),
    'anon_teams_select', has_table_privilege('anon', 'public.teams', 'SELECT'),
    'service_events_select', has_table_privilege('service_role', 'public.events', 'SELECT'),
    'service_teams_select', has_table_privilege('service_role', 'public.teams', 'SELECT'),
    'anon_attendance_execute', has_function_privilege('anon', 'public.get_audience_attendance(uuid,text)', 'EXECUTE'),
    'authenticated_attendance_execute', has_function_privilege('authenticated', 'public.get_audience_attendance(uuid,text)', 'EXECUTE'),
    'service_attendance_execute', has_function_privilege('service_role', 'public.get_audience_attendance(uuid,text)', 'EXECUTE'),
    'anon_vote_execute', has_function_privilege('anon', 'public.submit_audience_vote(uuid,text)', 'EXECUTE'),
    'authenticated_vote_execute', has_function_privilege('authenticated', 'public.submit_audience_vote(uuid,text)', 'EXECUTE'),
    'service_vote_execute', has_function_privilege('service_role', 'public.submit_audience_vote(uuid,text)', 'EXECUTE'),
    'authenticated_vote_snapshot_execute', has_function_privilege('authenticated', 'public.get_audience_vote_snapshot(uuid)', 'EXECUTE'),
    'authenticated_judge_save_execute', has_function_privilege('authenticated', 'public.save_judge_scores(uuid,uuid,jsonb)', 'EXECUTE'),
    'authenticated_judge_submit_execute', has_function_privilege('authenticated', 'public.submit_judge_scores(uuid,uuid)', 'EXECUTE'),
    'authenticated_unlock_execute', has_function_privilege('authenticated', 'public.unlock_judge_submission(uuid,text)', 'EXECUTE')
  )
)::text;

rollback;
