alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.teams enable row level security;
alter table public.check_ins enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.audience_submissions enable row level security;
alter table public.audience_scores enable row level security;
alter table public.judge_assignments enable row level security;
alter table public.judge_submissions enable row level security;
alter table public.judge_scores enable row level security;
alter table public.result_snapshots enable row level security;
alter table public.prize_draws enable row level security;
alter table public.audit_logs enable row level security;

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and active = true;
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'ADMIN');

create policy profiles_admin_manage on public.profiles
for all to authenticated
using (public.current_app_role() = 'ADMIN')
with check (public.current_app_role() = 'ADMIN');

create policy events_staff_read on public.events
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF', 'JUDGE'));

create policy events_admin_staff_update on public.events
for update to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'))
with check (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy operational_staff_all_participants on public.participants
for all to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'))
with check (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy teams_authenticated_read on public.teams
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF', 'JUDGE'));

create policy teams_staff_manage on public.teams
for all to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'))
with check (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy check_ins_staff_read on public.check_ins
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy criteria_authenticated_read on public.evaluation_criteria
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF', 'JUDGE'));

create policy criteria_admin_manage on public.evaluation_criteria
for all to authenticated
using (public.current_app_role() = 'ADMIN')
with check (public.current_app_role() = 'ADMIN');

create policy audience_submissions_staff_read on public.audience_submissions
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy audience_scores_staff_read on public.audience_scores
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy assignments_staff_or_owner_read on public.judge_assignments
for select to authenticated
using (
  public.current_app_role() in ('ADMIN', 'STAFF') or
  (public.current_app_role() = 'JUDGE' and judge_user_id = auth.uid())
);

create policy assignments_admin_manage on public.judge_assignments
for all to authenticated
using (public.current_app_role() = 'ADMIN')
with check (public.current_app_role() = 'ADMIN');

create policy judge_submissions_staff_or_owner_read on public.judge_submissions
for select to authenticated
using (
  public.current_app_role() in ('ADMIN', 'STAFF') or
  (public.current_app_role() = 'JUDGE' and judge_user_id = auth.uid())
);

create policy judge_submissions_owner_insert on public.judge_submissions
for insert to authenticated
with check (
  public.current_app_role() = 'JUDGE' and judge_user_id = auth.uid() and
  exists (
    select 1 from public.judge_assignments assignment
    where assignment.event_id = judge_submissions.event_id
      and assignment.team_id = judge_submissions.team_id
      and assignment.judge_user_id = auth.uid()
      and assignment.active = true
  )
);

create policy judge_submissions_owner_update_draft on public.judge_submissions
for update to authenticated
using (public.current_app_role() = 'JUDGE' and judge_user_id = auth.uid() and status = 'DRAFT')
with check (public.current_app_role() = 'JUDGE' and judge_user_id = auth.uid());

create policy judge_scores_staff_or_owner_read on public.judge_scores
for select to authenticated
using (
  public.current_app_role() in ('ADMIN', 'STAFF') or
  exists (
    select 1 from public.judge_submissions submission
    where submission.id = judge_scores.submission_id and submission.judge_user_id = auth.uid()
  )
);

create policy judge_scores_owner_manage_draft on public.judge_scores
for all to authenticated
using (
  exists (
    select 1 from public.judge_submissions submission
    where submission.id = judge_scores.submission_id
      and submission.judge_user_id = auth.uid()
      and submission.status = 'DRAFT'
  )
)
with check (
  exists (
    select 1 from public.judge_submissions submission
    where submission.id = judge_scores.submission_id
      and submission.judge_user_id = auth.uid()
      and submission.status = 'DRAFT'
  )
);

create policy results_staff_read on public.result_snapshots
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy prize_staff_read on public.prize_draws
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

create policy audit_staff_read on public.audit_logs
for select to authenticated
using (public.current_app_role() in ('ADMIN', 'STAFF'));

revoke all on public.participants, public.check_ins, public.audience_submissions,
  public.audience_scores, public.prize_draws, public.result_snapshots, public.audit_logs
from anon;
