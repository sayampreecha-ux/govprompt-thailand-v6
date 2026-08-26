-- Enforce assumptions used by RLS/RPC authorization at the database layer.
-- Department-scoped roles must always have a department; org-wide roles must not.
-- Every department reference must belong to the same organization as its parent row.

alter table public.departments
  add constraint departments_organization_id_id_key unique (organization_id, id);

alter table public.organization_memberships
  add constraint organization_memberships_role_department_scope_check check (
    (role in ('ORG_ADMIN','EXECUTIVE','AUDITOR') and department_id is null)
    or (role in ('DIRECTOR','OFFICER') and department_id is not null)
  ),
  add constraint organization_memberships_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id);

alter table public.projects
  add constraint projects_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id);

alter table public.tasks
  add constraint tasks_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id);

alter table public.import_batches
  add constraint import_batches_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id);

alter table public.audit_events
  add constraint audit_events_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id);

alter table public.pilot_invites
  add constraint pilot_invites_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id);
