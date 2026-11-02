begin;

create table public.scoring_policy_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  version text not null check (char_length(trim(version)) between 1 and 50),
  professional_weight integer not null check (professional_weight between 0 and 100),
  audience_weight integer not null check (audience_weight between 0 and 100),
  judge_count integer not null check (judge_count > 0),
  professional_max_per_judge integer not null check (professional_max_per_judge > 0),
  audience_conversion_rule text not null default '' check (char_length(audience_conversion_rule) <= 2000),
  tie_break_rule text not null default '' check (char_length(tie_break_rule) <= 2000),
  category_aggregation_rule text not null default '' check (char_length(category_aggregation_rule) <= 2000),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED')),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scoring_policy_weight_total check (professional_weight + audience_weight = 100),
  constraint scoring_policy_version_unique unique (event_id, version),
  constraint scoring_policy_approval_state check (
    (status = 'DRAFT' and approved_by is null and approved_at is null)
    or (status = 'APPROVED' and approved_by is not null and approved_at is not null)
  )
);

create unique index scoring_policy_one_draft_per_event on public.scoring_policy_versions (event_id) where status = 'DRAFT';
create unique index scoring_policy_one_approved_per_event on public.scoring_policy_versions (event_id) where status = 'APPROVED';

create or replace function public.prevent_scoring_policy_reopen()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'DRAFT' and exists (
    select 1 from public.scoring_policy_versions where event_id = new.event_id and status = 'APPROVED'
  ) then raise exception 'SCORING_POLICY_ALREADY_APPROVED'; end if;
  return new;
end;
$$;
create trigger scoring_policy_prevent_reopen before insert on public.scoring_policy_versions
  for each row execute function public.prevent_scoring_policy_reopen();

alter table public.scoring_policy_versions enable row level security;
create policy scoring_policy_staff_read on public.scoring_policy_versions for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'STAFF'));
create policy scoring_policy_staff_insert on public.scoring_policy_versions for insert to authenticated
  with check (public.current_app_role() in ('ADMIN', 'STAFF') and status = 'DRAFT');
create policy scoring_policy_staff_draft_update on public.scoring_policy_versions for update to authenticated
  using (public.current_app_role() in ('ADMIN', 'STAFF') and status = 'DRAFT')
  with check (public.current_app_role() in ('ADMIN', 'STAFF') and status = 'DRAFT');

create or replace function public.approve_scoring_policy(p_event_id uuid, p_policy_id uuid)
returns public.scoring_policy_versions language plpgsql security definer set search_path = public as $$
declare saved public.scoring_policy_versions%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':scoring-policy', 0));
  select * into saved from public.scoring_policy_versions where id = p_policy_id and event_id = p_event_id for update;
  if saved.id is null then raise exception 'SCORING_POLICY_NOT_FOUND'; end if;
  if saved.status <> 'DRAFT' then raise exception 'SCORING_POLICY_ALREADY_APPROVED'; end if;
  if length(trim(saved.audience_conversion_rule)) = 0
    or length(trim(saved.tie_break_rule)) = 0
    or length(trim(saved.category_aggregation_rule)) = 0 then
    raise exception 'SCORING_POLICY_INCOMPLETE';
  end if;
  if exists (select 1 from public.scoring_policy_versions where event_id = p_event_id and status = 'APPROVED') then
    raise exception 'SCORING_POLICY_APPROVAL_EXISTS';
  end if;
  update public.scoring_policy_versions
    set status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), updated_at = now()
    where id = p_policy_id returning * into saved;
  insert into public.audit_logs (event_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_event_id, auth.uid(), 'SCORING_POLICY_APPROVE', 'scoring_policy', p_policy_id,
    jsonb_build_object('version', saved.version, 'professional_weight', saved.professional_weight, 'audience_weight', saved.audience_weight));
  return saved;
end;
$$;

revoke all on public.scoring_policy_versions from anon, authenticated;
grant select, insert, update on public.scoring_policy_versions to authenticated;
grant select on public.scoring_policy_versions to service_role;
revoke all on function public.approve_scoring_policy(uuid, uuid) from public, anon;
grant execute on function public.approve_scoring_policy(uuid, uuid) to authenticated;
revoke all on function public.prevent_scoring_policy_reopen() from public, anon, authenticated;

commit;
