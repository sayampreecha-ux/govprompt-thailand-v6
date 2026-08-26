-- Harden Pilot mutation boundary.
-- RLS remains defense-in-depth, but browser clients cannot mutate projects/tasks directly.
-- Mutations must use reviewed RPC/server functions that also append audit events.

revoke insert, update, delete on public.projects from authenticated;
revoke insert, update, delete on public.tasks from authenticated;

-- Keep read access through RLS-protected SELECT policies.
grant select on public.projects, public.tasks to authenticated;
