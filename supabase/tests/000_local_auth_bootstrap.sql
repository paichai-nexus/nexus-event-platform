-- Plain PostgreSQL compatibility shim for isolated migration tests only.
-- Never run this file against a Supabase project.
do $$ begin execute 'create role anon nologin'; exception when duplicate_object then null; end $$;
do $$ begin execute 'create role authenticated nologin'; exception when duplicate_object then null; end $$;
do $$ begin execute 'create role service_role nologin bypassrls'; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text unique);
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
