-- Atomic project progress update for Pilot vertical slice.
-- Security-definer is intentionally narrow and re-checks membership/role inside the function.

create or replace function public.update_project_progress(
  p_project_id uuid,
  p_actual_progress numeric,
  p_status text,
  p_problem_summary text default null,
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
  v_previous_status text;
  v_changed_fields jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_actual_progress is null or p_actual_progress < 0 or p_actual_progress > 100 then
    raise exception 'INVALID_PROGRESS';
  end if;

  if p_status not in ('NOT_STARTED','IN_PROGRESS','WAITING_REVIEW','COMPLETED','BLOCKED') then
    raise exception 'INVALID_STATUS';
  end if;

  if p_status = 'COMPLETED' and p_actual_progress <> 100 then
    raise exception 'COMPLETED_PROGRESS_MISMATCH';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_project.organization_id
    and user_id = v_user_id
    and active = true;

  if not found then
    raise exception 'ROLE_FORBIDDEN';
  end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (v_membership.role = 'DIRECTOR' and v_membership.department_id = v_project.department_id)
    or (v_membership.role = 'OFFICER' and v_membership.department_id = v_project.department_id and v_project.owner_user_id = v_user_id)
  ) then
    raise exception 'ROLE_FORBIDDEN';
  end if;

  if p_expected_updated_at is not null and v_project.updated_at <> p_expected_updated_at then
    raise exception 'CONFLICT_VERSION';
  end if;

  v_previous_status := v_project.status;

  if v_project.actual_progress is distinct from p_actual_progress then
    v_changed_fields := v_changed_fields || jsonb_build_array('actualProgress');
  end if;
  if v_project.status is distinct from p_status then
    v_changed_fields := v_changed_fields || jsonb_build_array('status');
  end if;
  if v_project.problem_summary is distinct from p_problem_summary then
    v_changed_fields := v_changed_fields || jsonb_build_array('problem');
  end if;

  update public.projects
  set actual_progress = p_actual_progress,
      status = p_status,
      problem_summary = p_problem_summary,
      last_updated_at = now(),
      updated_at = now()
  where id = v_project.id
  returning * into v_project;

  insert into public.audit_events (
    organization_id,
    department_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    occurred_at,
    request_id,
    metadata_json
  ) values (
    v_project.organization_id,
    v_project.department_id,
    v_user_id,
    case when v_previous_status is distinct from p_status then 'PROJECT_STATUS_CHANGED' else 'PROJECT_UPDATED' end,
    'PROJECT',
    v_project.id::text,
    now(),
    p_request_id,
    jsonb_build_object(
      'projectId', v_project.id::text,
      'changedFields', v_changed_fields,
      'previousStatus', v_previous_status,
      'nextStatus', p_status,
      'source', 'WORK_TRACKING_RPC'
    )
  );

  return v_project;
end;
$$;

revoke all on function public.update_project_progress(uuid,numeric,text,text,timestamptz,text) from public, anon;
grant execute on function public.update_project_progress(uuid,numeric,text,text,timestamptz,text) to authenticated;
