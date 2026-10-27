-- Staging verification: server-side public snapshot reads.
-- Do not grant access to anon or authenticated.

grant usage on schema public to service_role;

grant select on table
  public.events,
  public.teams
to service_role;
