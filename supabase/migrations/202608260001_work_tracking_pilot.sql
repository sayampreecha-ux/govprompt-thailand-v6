-- GP Work Tracking Pilot
-- Security posture: authenticated only, organization + department scoped, fail closed.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text,
  province text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  role text not null check (role in ('ORG_ADMIN','EXECUTIVE','DIRECTOR','OFFICER','AUDITOR')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  project_code text not null,
  project_type text,
  name text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  location_text text,
  contract_no text,
  contractor_name text,
  budget_amount numeric(16,2) not null default 0 check (budget_amount >= 0),
  spent_amount numeric(16,2) not null default 0 check (spent_amount >= 0),
  planned_progress numeric(5,2) not null default 0 check (planned_progress between 0 and 100),
  actual_progress numeric(5,2) not null default 0 check (actual_progress between 0 and 100),
  start_date date,
  due_date date,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','IN_PROGRESS','WAITING_REVIEW','COMPLETED','BLOCKED')),
  problem_summary text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, project_code),
  check (start_date is null or due_date is null or start_date <= due_date),
  check (status <> 'COMPLETED' or actual_progress = 100)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','IN_PROGRESS','WAITING_REVIEW','COMPLETED','BLOCKED')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  filename text not null,
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  status text not null default 'PREVIEW' check (status in ('PREVIEW','CONFIRMED','REJECTED','COMMITTED')),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  occurred_at timestamptz not null default now(),
  request_id text,
  metadata_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_memberships_user_org on public.organization_memberships(user_id, organization_id) where active = true;
create index if not exists idx_projects_org_department_status on public.projects(organization_id, department_id, status);
create index if not exists idx_projects_org_due on public.projects(organization_id, due_date);
create index if not exists idx_projects_org_owner on public.projects(organization_id, owner_user_id);
create index if not exists idx_tasks_org_department_status on public.tasks(organization_id, department_id, status);
create index if not exists idx_tasks_org_assigned on public.tasks(organization_id, assigned_user_id);
create index if not exists idx_audit_org_time on public.audit_events(organization_id, occurred_at desc);
create index if not exists idx_audit_entity on public.audit_events(organization_id, entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_membership_updated_at on public.organization_memberships;
create trigger trg_membership_updated_at before update on public.organization_memberships
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.organizations, public.departments, public.organization_memberships, public.projects, public.tasks, public.import_batches, public.audit_events from anon, authenticated;
grant select on public.organizations, public.departments, public.organization_memberships, public.projects, public.tasks, public.import_batches, public.audit_events to authenticated;
grant insert, update, delete on public.projects, public.tasks to authenticated;

-- Memberships are managed server-side in the Pilot. Client may read only its own active membership rows.
create policy memberships_select_own on public.organization_memberships
for select to authenticated
using (user_id = auth.uid() and active = true);

create policy organizations_select_member on public.organizations
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = organizations.id and m.user_id = auth.uid() and m.active = true
));

create policy departments_select_member on public.departments
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = departments.organization_id and m.user_id = auth.uid() and m.active = true
));

create policy projects_select_scope on public.projects
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role in ('DIRECTOR','OFFICER') and m.department_id = projects.department_id)
    )
));

create policy projects_insert_scope on public.projects
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = projects.department_id)
      or (m.role = 'OFFICER' and m.department_id = projects.department_id and projects.owner_user_id = auth.uid())
    )
));

create policy projects_update_scope on public.projects
for update to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = projects.department_id)
      or (m.role = 'OFFICER' and m.department_id = projects.department_id and projects.owner_user_id = auth.uid())
    )
))
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = projects.department_id)
      or (m.role = 'OFFICER' and m.department_id = projects.department_id and projects.owner_user_id = auth.uid())
    )
));

create policy projects_delete_admin on public.projects
for delete to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = projects.organization_id
    and m.user_id = auth.uid() and m.active = true and m.role = 'ORG_ADMIN'
));

create policy tasks_select_scope on public.tasks
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role in ('DIRECTOR','OFFICER') and m.department_id = tasks.department_id)
    )
));

create policy tasks_insert_scope on public.tasks
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = tasks.department_id)
      or (m.role = 'OFFICER' and m.department_id = tasks.department_id and tasks.assigned_user_id = auth.uid())
    )
));

create policy tasks_update_scope on public.tasks
for update to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = tasks.department_id)
      or (m.role = 'OFFICER' and m.department_id = tasks.department_id and tasks.assigned_user_id = auth.uid())
    )
))
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role = 'ORG_ADMIN'
      or (m.role = 'DIRECTOR' and m.department_id = tasks.department_id)
      or (m.role = 'OFFICER' and m.department_id = tasks.department_id and tasks.assigned_user_id = auth.uid())
    )
));

create policy tasks_delete_admin on public.tasks
for delete to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = tasks.organization_id
    and m.user_id = auth.uid() and m.active = true and m.role = 'ORG_ADMIN'
));

create policy import_batches_select_scope on public.import_batches
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = import_batches.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role in ('DIRECTOR','OFFICER') and m.department_id = import_batches.department_id)
    )
));

create policy audit_select_scope on public.audit_events
for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = audit_events.organization_id
    and m.user_id = auth.uid() and m.active = true
    and (
      m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
      or (m.role = 'DIRECTOR' and m.department_id = audit_events.department_id)
    )
));

-- No client INSERT/UPDATE/DELETE grants on memberships/import_batches/audit_events.
-- Those mutations must be performed through a trusted server/Edge Function after authorization.
