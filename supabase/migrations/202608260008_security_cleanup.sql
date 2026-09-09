-- Final security cleanup before live auth/RLS integration tests.

-- Existing project-level helper is an event-trigger function and does not need API execution rights.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Tighten create_project ownership: operational owner must be active in same department
-- and have DIRECTOR or OFFICER role. ORG_ADMIN may create unassigned projects.
create or replace function public.create_project(
  p_organization_id uuid,
  p_department_id uuid,
  p_project_code text,
  p_name text,
  p_project_type text default null,
  p_owner_user_id uuid default null,
  p_location_text text default null,
  p_contract_no text default null,
  p_contractor_name text default null,
  p_budget_amount numeric default 0,
  p_planned_progress numeric default 0,
  p_start_date date default null,
  p_due_date date default null,
  p_request_id text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.organization_memberships%rowtype;
  v_owner public.organization_memberships%rowtype;
  v_project public.projects%rowtype;
  v_owner_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null or p_department_id is null then raise exception 'SCOPE_REQUIRED'; end if;
  if nullif(btrim(p_project_code), '') is null then raise exception 'PROJECT_CODE_REQUIRED'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'PROJECT_NAME_REQUIRED'; end if;
  if p_budget_amount < 0 then raise exception 'INVALID_BUDGET'; end if;
  if p_planned_progress < 0 or p_planned_progress > 100 then raise exception 'INVALID_PROGRESS'; end if;
  if p_start_date is not null and p_due_date is not null and p_start_date > p_due_date then raise exception 'INVALID_DATE_ORDER'; end if;

  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.organization_id = p_organization_id and d.active = true
  ) then raise exception 'DEPARTMENT_NOT_ALLOWED'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = p_organization_id and user_id = v_user_id and active = true;
  if not found then raise exception 'TENANT_MISMATCH'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (v_membership.role = 'DIRECTOR' and v_membership.department_id = p_department_id)
    or (v_membership.role = 'OFFICER' and v_membership.department_id = p_department_id)
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  v_owner_id := case
    when v_membership.role = 'OFFICER' then v_user_id
    else p_owner_user_id
  end;

  if v_owner_id is not null then
    select * into v_owner
    from public.organization_memberships
    where organization_id = p_organization_id
      and user_id = v_owner_id
      and active = true
      and department_id = p_department_id
      and role in ('DIRECTOR','OFFICER');
    if not found then raise exception 'OWNER_NOT_ALLOWED'; end if;
  end if;

  insert into public.projects(
    organization_id, department_id, project_code, project_type, name, owner_user_id,
    location_text, contract_no, contractor_name, budget_amount, spent_amount,
    planned_progress, actual_progress, start_date, due_date, status,
    created_by_user_id, last_updated_at
  ) values (
    p_organization_id, p_department_id, btrim(p_project_code), nullif(btrim(p_project_type), ''), btrim(p_name), v_owner_id,
    nullif(btrim(p_location_text), ''), nullif(btrim(p_contract_no), ''), nullif(btrim(p_contractor_name), ''), p_budget_amount, 0,
    p_planned_progress, 0, p_start_date, p_due_date, 'NOT_STARTED', v_user_id, now()
  ) returning * into v_project;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_project.organization_id, v_project.department_id, v_user_id, 'PROJECT_CREATED', 'PROJECT', v_project.id::text, now(), p_request_id,
    jsonb_build_object('projectId', v_project.id::text, 'changedFields', jsonb_build_array('created'), 'source', 'WORK_TRACKING_RPC')
  );

  return v_project;
end;
$$;

-- Tighten create_task assignee using the same operational target policy.
create or replace function public.create_task(
  p_project_id uuid,
  p_title text,
  p_assigned_user_id uuid default null,
  p_priority text default 'NORMAL',
  p_due_at timestamptz default null,
  p_request_id text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_membership public.organization_memberships%rowtype;
  v_target public.organization_memberships%rowtype;
  v_task public.tasks%rowtype;
  v_assignee uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'TASK_TITLE_REQUIRED'; end if;
  if p_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'INVALID_PRIORITY'; end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_project.organization_id and user_id = v_user_id and active = true;
  if not found then raise exception 'TENANT_MISMATCH'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (v_membership.role = 'DIRECTOR' and v_membership.department_id = v_project.department_id)
    or (v_membership.role = 'OFFICER' and v_membership.department_id = v_project.department_id)
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  v_assignee := case
    when v_membership.role = 'OFFICER' then v_user_id
    else p_assigned_user_id
  end;

  if v_assignee is not null then
    select * into v_target
    from public.organization_memberships
    where organization_id = v_project.organization_id
      and user_id = v_assignee
      and active = true
      and department_id = v_project.department_id
      and role in ('DIRECTOR','OFFICER');
    if not found then raise exception 'ASSIGNEE_NOT_ALLOWED'; end if;
  end if;

  insert into public.tasks(
    organization_id, department_id, project_id, title, assigned_user_id, status,
    priority, due_at, created_by_user_id
  ) values (
    v_project.organization_id, v_project.department_id, v_project.id, btrim(p_title), v_assignee, 'NOT_STARTED',
    p_priority, p_due_at, v_user_id
  ) returning * into v_task;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_task.organization_id, v_task.department_id, v_user_id, 'TASK_CREATED', 'TASK', v_task.id::text, now(), p_request_id,
    jsonb_build_object('taskId', v_task.id::text, 'projectId', v_task.project_id::text, 'changedFields', jsonb_build_array('created'), 'source', 'WORK_TRACKING_RPC')
  );

  return v_task;
end;
$$;

revoke all on function public.create_project(uuid,uuid,text,text,text,uuid,text,text,text,numeric,numeric,date,date,text) from public, anon;
grant execute on function public.create_project(uuid,uuid,text,text,text,uuid,text,text,text,numeric,numeric,date,date,text) to authenticated;
revoke all on function public.create_task(uuid,text,uuid,text,timestamptz,text) from public, anon;
grant execute on function public.create_task(uuid,text,uuid,text,timestamptz,text) to authenticated;
