begin;

create table public.paper_judge_scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  judge_slot smallint not null check (judge_slot between 1 and 3),
  document_score integer not null check (document_score between 0 and 50),
  presentation_score integer not null check (presentation_score between 0 and 100),
  qna_score integer not null check (qna_score between 0 and 50),
  total_score integer generated always as (document_score + presentation_score + qna_score) stored,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED')),
  entered_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, team_id, judge_slot),
  constraint paper_judge_score_same_event foreign key (event_id, team_id) references public.teams(event_id, id) on delete restrict,
  constraint paper_judge_submission_time check ((status = 'DRAFT' and submitted_at is null) or (status = 'SUBMITTED' and submitted_at is not null))
);

create table public.paper_judge_score_revisions (
  id uuid primary key default gen_random_uuid(),
  paper_score_id uuid not null references public.paper_judge_scores(id) on delete restrict,
  document_score integer not null,
  presentation_score integer not null,
  qna_score integer not null,
  status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

alter table public.paper_judge_scores enable row level security;
alter table public.paper_judge_score_revisions enable row level security;

create policy paper_judge_scores_staff_read on public.paper_judge_scores for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'STAFF'));
create policy paper_judge_score_revisions_staff_read on public.paper_judge_score_revisions for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'STAFF'));

create function public.record_paper_judge_score(
  p_event_id uuid, p_team_id uuid, p_judge_slot smallint,
  p_document_score integer, p_presentation_score integer, p_qna_score integer, p_submit boolean
) returns public.paper_judge_scores
language plpgsql security definer set search_path = public, extensions as $$
declare
  existing public.paper_judge_scores%rowtype;
  saved public.paper_judge_scores%rowtype;
  selected_event public.events%rowtype;
begin
  if coalesce(public.current_app_role() in ('ADMIN', 'STAFF'), false) = false then raise exception 'FORBIDDEN'; end if;
  if p_judge_slot not between 1 and 3 or p_document_score not between 0 and 50
    or p_presentation_score not between 0 and 100 or p_qna_score not between 0 and 50 then
    raise exception 'INVALID_PAPER_SCORE';
  end if;
  select * into selected_event from public.events where id = p_event_id for share;
  if selected_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if selected_event.status in ('FINALIZED', 'ENDED') or selected_event.result_status <> 'LOCKED' then raise exception 'RESULT_FINALIZED'; end if;
  if not exists (select 1 from public.teams where id = p_team_id and event_id = p_event_id and active) then raise exception 'TEAM_NOT_FOUND'; end if;
  select * into existing from public.paper_judge_scores where event_id = p_event_id and team_id = p_team_id and judge_slot = p_judge_slot for update;
  if existing.status = 'SUBMITTED' then raise exception 'PAPER_SUBMISSION_LOCKED'; end if;
  if existing.id is not null then
    insert into public.paper_judge_score_revisions (paper_score_id, document_score, presentation_score, qna_score, status, changed_by)
    values (existing.id, existing.document_score, existing.presentation_score, existing.qna_score, existing.status, auth.uid());
  end if;
  insert into public.paper_judge_scores (event_id, team_id, judge_slot, document_score, presentation_score, qna_score, status, entered_by, submitted_at)
  values (p_event_id, p_team_id, p_judge_slot, p_document_score, p_presentation_score, p_qna_score,
    case when p_submit then 'SUBMITTED' else 'DRAFT' end, auth.uid(), case when p_submit then now() else null end)
  on conflict (event_id, team_id, judge_slot) do update set
    document_score = excluded.document_score, presentation_score = excluded.presentation_score, qna_score = excluded.qna_score,
    status = excluded.status, entered_by = auth.uid(), submitted_at = excluded.submitted_at, updated_at = now()
  returning * into saved;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), case when p_submit then 'PAPER_JUDGE_SCORE_SUBMIT' else 'PAPER_JUDGE_SCORE_SAVE' end,
    'paper_judge_score', saved.id, jsonb_build_object('team_id', p_team_id, 'judge_slot', p_judge_slot, 'total_score', saved.total_score));
  return saved;
end;
$$;

revoke all on public.paper_judge_scores, public.paper_judge_score_revisions from anon, authenticated;
grant select on public.paper_judge_scores, public.paper_judge_score_revisions to authenticated;
revoke all on function public.record_paper_judge_score(uuid, uuid, smallint, integer, integer, integer, boolean) from public;
grant execute on function public.record_paper_judge_score(uuid, uuid, smallint, integer, integer, integer, boolean) to authenticated;

commit;
