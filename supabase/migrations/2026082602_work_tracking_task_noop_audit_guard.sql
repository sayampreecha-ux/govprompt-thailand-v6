-- Keep Task audit history meaningful: no-op state updates do not mutate timestamps or add audit events.
create or replace function public.update_task_state(
  p_task_id uuid,
  p_status text,
  p_priority text,
  p_due_at timestamptz default null,
  p_completed_at timestamptz default null,
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
  v_changed_fields jsonb := '[]'::jsonb;
  v_previous_status text;
  v_effective_completed_at timestamptz;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_status not in ('NOT_STARTED','IN_PROGRESS','WAITING_REVIEW','COMPLETED','BLOCKED') then raise exception 'INVALID_STATUS'; end if;
  if p_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'INVALID_PRIORITY'; end if;
  if p_status <> 'COMPLETED' and p_completed_at is not null then raise exception 'COMPLETED_AT_STATUS_MISMATCH'; end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_task.organization_id and user_id = v_user_id and active = true;
  if not found then raise exception 'ROLE_FORBIDDEN'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (v_membership.role = 'DIRECTOR' and v_membership.department_id = v_task.department_id)
    or (v_membership.role = 'OFFICER' and v_membership.department_id = v_task.department_id and v_task.assigned_user_id = v_user_id)
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  if p_expected_updated_at is not null and v_task.updated_at <> p_expected_updated_at then
    raise exception 'CONFLICT_VERSION';
  end if;

  v_previous_status := v_task.status;
  v_effective_completed_at := case
    when p_status = 'COMPLETED' then coalesce(p_completed_at, v_task.completed_at, now())
    else null
  end;

  if v_task.status is distinct from p_status then v_changed_fields := v_changed_fields || jsonb_build_array('status'); end if;
  if v_task.priority is distinct from p_priority then v_changed_fields := v_changed_fields || jsonb_build_array('priority'); end if;
  if v_task.due_at is distinct from p_due_at then v_changed_fields := v_changed_fields || jsonb_build_array('dueAt'); end if;
  if v_task.completed_at is distinct from v_effective_completed_at then v_changed_fields := v_changed_fields || jsonb_build_array('completedAt'); end if;

  if jsonb_array_length(v_changed_fields) = 0 then
    return v_task;
  end if;

  update public.tasks
  set status = p_status,
      priority = p_priority,
      due_at = p_due_at,
      completed_at = v_effective_completed_at,
      updated_at = now()
  where id = v_task.id
  returning * into v_task;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_task.organization_id, v_task.department_id, v_user_id, 'TASK_UPDATED', 'TASK', v_task.id::text, now(), p_request_id,
    jsonb_build_object(
      'taskId', v_task.id::text,
      'projectId', v_task.project_id::text,
      'changedFields', v_changed_fields,
      'previousStatus', v_previous_status,
      'nextStatus', p_status,
      'source', 'WORK_TRACKING_RPC'
    )
  );

  return v_task;
end;
$$;

revoke all on function public.update_task_state(uuid,text,text,timestamptz,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.update_task_state(uuid,text,text,timestamptz,timestamptz,timestamptz,text) to authenticated;
