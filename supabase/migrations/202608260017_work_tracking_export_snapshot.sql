-- Audited organization-scoped logical export for GP Work Tracking Pilot.
-- The export intentionally excludes auth.users, pilot invite emails and raw CSV source files.

create or replace function public.export_work_tracking_snapshot(
  p_organization_id uuid,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.organization_memberships%rowtype;
  v_exported_at timestamptz := now();
  v_snapshot jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null then raise exception 'ORGANIZATION_REQUIRED'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = p_organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'TENANT_MISMATCH'; end if;

  if v_membership.role not in ('ORG_ADMIN', 'AUDITOR') then
    raise exception 'ROLE_FORBIDDEN';
  end if;

  insert into public.audit_events(
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
    p_organization_id,
    null,
    v_user_id,
    'EXPORT_CREATED',
    'ORGANIZATION',
    p_organization_id::text,
    v_exported_at,
    p_request_id,
    jsonb_build_object(
      'schemaVersion', 'work-tracking-export-v1',
      'source', 'WORK_TRACKING_EXPORT_RPC'
    )
  );

  select jsonb_build_object(
    'schemaVersion', 'work-tracking-export-v1',
    'exportedAt', v_exported_at,
    'organization', (
      select jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'organizationType', o.organization_type,
        'province', o.province,
        'active', o.active,
        'createdAt', o.created_at
      )
      from public.organizations o
      where o.id = p_organization_id
    ),
    'departments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'organizationId', d.organization_id,
          'name', d.name,
          'active', d.active,
          'createdAt', d.created_at
        ) order by d.name, d.id
      )
      from public.departments d
      where d.organization_id = p_organization_id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'organizationId', p.organization_id,
          'departmentId', p.department_id,
          'projectCode', p.project_code,
          'projectType', p.project_type,
          'name', p.name,
          'ownerUserId', p.owner_user_id,
          'location', p.location_text,
          'contractNo', p.contract_no,
          'contractor', p.contractor_name,
          'budget', p.budget_amount,
          'spent', p.spent_amount,
          'plannedProgress', p.planned_progress,
          'actualProgress', p.actual_progress,
          'startDate', p.start_date,
          'dueDate', p.due_date,
          'status', p.status,
          'problem', p.problem_summary,
          'createdByUserId', p.created_by_user_id,
          'lastUpdatedAt', p.last_updated_at,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at
        ) order by p.project_code, p.id
      )
      from public.projects p
      where p.organization_id = p_organization_id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'organizationId', t.organization_id,
          'departmentId', t.department_id,
          'projectId', t.project_id,
          'title', t.title,
          'assignedUserId', t.assigned_user_id,
          'status', t.status,
          'priority', t.priority,
          'dueAt', t.due_at,
          'completedAt', t.completed_at,
          'createdByUserId', t.created_by_user_id,
          'createdAt', t.created_at,
          'updatedAt', t.updated_at
        ) order by t.created_at, t.id
      )
      from public.tasks t
      where t.organization_id = p_organization_id
    ), '[]'::jsonb),
    'importBatches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'organizationId', b.organization_id,
          'departmentId', b.department_id,
          'filename', b.filename,
          'totalRows', b.total_rows,
          'validRows', b.valid_rows,
          'errorRows', b.error_rows,
          'warningCount', b.warning_count,
          'status', b.status,
          'createdByUserId', b.created_by_user_id,
          'createdAt', b.created_at,
          'committedAt', b.committed_at
        ) order by b.created_at, b.id
      )
      from public.import_batches b
      where b.organization_id = p_organization_id
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'organizationId', a.organization_id,
          'departmentId', a.department_id,
          'actorUserId', a.actor_user_id,
          'action', a.action,
          'entityType', a.entity_type,
          'entityId', a.entity_id,
          'occurredAt', a.occurred_at,
          'requestId', a.request_id,
          'metadata', a.metadata_json
        ) order by a.occurred_at, a.id
      )
      from public.audit_events a
      where a.organization_id = p_organization_id
    ), '[]'::jsonb)
  ) into v_snapshot;

  return v_snapshot;
end;
$$;

revoke all on function public.export_work_tracking_snapshot(uuid,text) from public, anon;
grant execute on function public.export_work_tracking_snapshot(uuid,text) to authenticated;
