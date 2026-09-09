-- Optimize RLS auth lookups and add covering indexes reported by Supabase advisor.

create index if not exists idx_memberships_department on public.organization_memberships(department_id);
create index if not exists idx_projects_department on public.projects(department_id);
create index if not exists idx_projects_owner_user on public.projects(owner_user_id);
create index if not exists idx_projects_created_by on public.projects(created_by_user_id);
create index if not exists idx_tasks_department on public.tasks(department_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_assigned_user on public.tasks(assigned_user_id);
create index if not exists idx_tasks_created_by on public.tasks(created_by_user_id);
create index if not exists idx_import_batches_org on public.import_batches(organization_id);
create index if not exists idx_import_batches_department on public.import_batches(department_id);
create index if not exists idx_import_batches_created_by on public.import_batches(created_by_user_id);
create index if not exists idx_audit_department on public.audit_events(department_id);
create index if not exists idx_audit_actor on public.audit_events(actor_user_id);

-- Replace auth.uid() with (select auth.uid()) so PostgreSQL can initialize it once per statement.
drop policy if exists memberships_select_own on public.organization_memberships;
create policy memberships_select_own on public.organization_memberships
for select to authenticated
using (user_id = (select auth.uid()) and active = true);

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = organizations.id and m.user_id = (select auth.uid()) and m.active = true
));

drop policy if exists departments_select_member on public.departments;
create policy departments_select_member on public.departments
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = departments.organization_id and m.user_id = (select auth.uid()) and m.active = true
));

drop policy if exists projects_select_scope on public.projects;
create policy projects_select_scope on public.projects
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role in ('DIRECTOR','OFFICER') and m.department_id = projects.department_id)
    )
));

drop policy if exists projects_insert_scope on public.projects;
create policy projects_insert_scope on public.projects
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = projects.department_id)
      or (m.role = 'OFFICER' and m.department_id = projects.department_id and projects.owner_user_id = (select auth.uid()))
    )
));

drop policy if exists projects_update_scope on public.projects;
create policy projects_update_scope on public.projects
for update to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = projects.department_id)
      or (m.role = 'OFFICER' and m.department_id = projects.department_id and projects.owner_user_id = (select auth.uid()))
    )
))
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = projects.department_id)
      or (m.role = 'OFFICER' and m.department_id = projects.department_id and projects.owner_user_id = (select auth.uid()))
    )
));

drop policy if exists projects_delete_admin on public.projects;
create policy projects_delete_admin on public.projects
for delete to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = (select auth.uid()) and m.active = true and m.role = 'ORG_ADMIN'
));

drop policy if exists tasks_select_scope on public.tasks;
create policy tasks_select_scope on public.tasks
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role in ('DIRECTOR','OFFICER') and m.department_id = tasks.department_id)
    )
));

drop policy if exists tasks_insert_scope on public.tasks;
create policy tasks_insert_scope on public.tasks
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = tasks.department_id)
      or (m.role = 'OFFICER' and m.department_id = tasks.department_id and tasks.assigned_user_id = (select auth.uid()))
    )
));

drop policy if exists tasks_update_scope on public.tasks;
create policy tasks_update_scope on public.tasks
for update to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = tasks.department_id)
      or (m.role = 'OFFICER' and m.department_id = tasks.department_id and tasks.assigned_user_id = (select auth.uid()))
    )
))
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = tasks.department_id)
      or (m.role = 'OFFICER' and m.department_id = tasks.department_id and tasks.assigned_user_id = (select auth.uid()))
    )
));

drop policy if exists tasks_delete_admin on public.tasks;
create policy tasks_delete_admin on public.tasks
for delete to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = (select auth.uid()) and m.active = true and m.role = 'ORG_ADMIN'
));

drop policy if exists import_batches_select_scope on public.import_batches;
create policy import_batches_select_scope on public.import_batches
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = import_batches.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role in ('DIRECTOR','OFFICER') and m.department_id = import_batches.department_id)
    )
));

drop policy if exists audit_select_scope on public.audit_events;
create policy audit_select_scope on public.audit_events
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = audit_events.organization_id
    and m.user_id = (select auth.uid()) and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role = 'DIRECTOR' and m.department_id = audit_events.department_id)
    )
));
