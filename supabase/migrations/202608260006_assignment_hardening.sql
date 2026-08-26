-- Harden assignment boundaries for GP Work Tracking Pilot.
-- Operational ownership is limited to active members in the same organization and department.

create or replace function public.assign_project(
  p_project_id uuid,
  p_owner_user_id uuid,
  p_expected_updated_at timestamptz default null,
  p_request_id text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_membership public.organization_memberships%rowtype;
  v_target public.organization_memberships%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_owner_user_id is null then raise exception 'OWNER_REQUIRED'; end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_project.organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'ROLE_FORBIDDEN'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (v_membership.role = 'DIRECTOR' and v_membership.department_id = v_project.department_id)
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  select * into v_target
  from public.organization_memberships
  where organization_id = v_project.organization_id
    and user_id = p_owner_user_id
    and active = true
    and department_id = v_project.department_id
    and role in ('DIRECTOR','OFFICER');
  if not found then raise exception 'OWNER_NOT_ALLOWED'; end if;

  if p_expected_updated_at is not null and v_project.updated_at <> p_expected_updated_at then
    raise exception 'CONFLICT_VERSION';
  end if;

  update public.projects
  set owner_user_id = p_owner_user_id,
      last_updated_at = now(),
      updated_at = now()
  where id = v_project.id
  returning * into v_project;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_project.organization_id,
    v_project.department_id,
    v_user_id,
    'PROJECT_ASSIGNED',
    'PROJECT',
    v_project.id::text,
    now(),
    p_request_id,
    jsonb_build_object(
      'projectId', v_project.id::text,
      'changedFields', jsonb_build_array('ownerUserId'),
      'source', 'WORK_TRACKING_RPC'
    )
  );

  return v_project;
end;
$$;

-- Replace task assignment with a stricter target-role policy.
create or replace function public.assign_task(
  p_task_id uuid,
  p_assigned_user_id uuid,
  p_expected_updated_at timestamptz default null,
  p_request_id text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_membership public.organization_memberships%rowtype;
  v_target public.organization_memberships%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_assigned_user_id is null then raise exception 'ASSIGNEE_REQUIRED'; end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_task.organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'ROLE_FORBIDDEN'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (v_membership.role = 'DIRECTOR' and v_membership.department_id = v_task.department_id)
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  select * into v_target
  from public.organization_memberships
  where organization_id = v_task.organization_id
    and user_id = p_assigned_user_id
    and active = true
    and department_id = v_task.department_id
    and role in ('DIRECTOR','OFFICER');
  if not found then raise exception 'ASSIGNEE_NOT_ALLOWED'; end if;

  if p_expected_updated_at is not null and v_task.updated_at <> p_expected_updated_at then
    raise exception 'CONFLICT_VERSION';
  end if;

  update public.tasks
  set assigned_user_id = p_assigned_user_id,
      updated_at = now()
  where id = v_task.id
  returning * into v_task;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_task.organization_id,
    v_task.department_id,
    v_user_id,
    'TASK_ASSIGNED',
    'TASK',
    v_task.id::text,
    now(),
    p_request_id,
    jsonb_build_object(
      'taskId', v_task.id::text,
      'projectId', v_task.project_id::text,
      'changedFields', jsonb_build_array('assignedUserId'),
      'source', 'WORK_TRACKING_RPC'
    )
  );

  return v_task;
end;
$$;

revoke all on function public.assign_project(uuid,uuid,timestamptz,text) from public, anon;
grant execute on function public.assign_project(uuid,uuid,timestamptz,text) to authenticated;
revoke all on function public.assign_task(uuid,uuid,timestamptz,text) from public, anon;
grant execute on function public.assign_task(uuid,uuid,timestamptz,text) to authenticated;
