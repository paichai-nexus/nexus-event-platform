begin;

alter table public.teams
  add column if not exists department text,
  add column if not exists advisor_name text,
  add column if not exists leader_name text,
  add column if not exists member_names text[] not null default '{}',
  add column if not exists presentation_topic text,
  add column if not exists promotion_enabled boolean not null default false;

alter table public.teams
  add constraint teams_department_length check (department is null or char_length(department) <= 100),
  add constraint teams_advisor_name_length check (advisor_name is null or char_length(advisor_name) <= 100),
  add constraint teams_leader_name_length check (leader_name is null or char_length(leader_name) <= 100),
  add constraint teams_member_names_count check (cardinality(member_names) <= 20),
  add constraint teams_presentation_topic_length check (presentation_topic is null or char_length(presentation_topic) <= 300);

comment on column public.teams.department is 'Presentation profile. Enter only after the official finalist roster is confirmed.';
comment on column public.teams.advisor_name is 'Presentation profile. Public display is limited to the active team snapshot.';
comment on column public.teams.member_names is 'Presentation profile. Do not seed unverified personal information.';

commit;
