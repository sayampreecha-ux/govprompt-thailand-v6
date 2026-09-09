-- Atomic server-side project import for GP Work Tracking Pilot.
-- The browser preview is UX only. This function re-validates every row before persistence.

create or replace function public.commit_project_import(
  p_organization_id uuid,
  p_department_id uuid,
  p_filename text,
  p_rows jsonb,
  p_confirm_warnings boolean default false,
  p_request_id text default null
)
returns public.import_batches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.organization_memberships%rowtype;
  v_batch public.import_batches%rowtype;
  v_row jsonb;
  v_project public.projects%rowtype;
  v_row_number integer := 0;
  v_total integer := 0;
  v_warning_count integer := 0;
  v_code text;
  v_name text;
  v_project_type text;
  v_owner_user_id uuid;
  v_owner public.organization_memberships%rowtype;
  v_location text;
  v_contract_no text;
  v_contractor text;
  v_budget numeric;
  v_spent numeric;
  v_planned numeric;
  v_actual numeric;
  v_start_date date;
  v_due_date date;
  v_status text;
  v_problem text;
  v_seen_codes text[] := array[]::text[];
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null or p_department_id is null then raise exception 'SCOPE_REQUIRED'; end if;
  if nullif(btrim(p_filename), '') is null then raise exception 'FILENAME_REQUIRED'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'IMPORT_ROWS_REQUIRED';
  end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'IMPORT_TOO_LARGE'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = p_organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'TENANT_MISMATCH'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (v_membership.role = 'DIRECTOR' and v_membership.department_id = p_department_id)
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  -- Department must belong to the requested organization.
  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.organization_id = p_organization_id and d.active = true
  ) then raise exception 'DEPARTMENT_NOT_ALLOWED'; end if;

  -- Validation pass. Any ERROR aborts the whole transaction.
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_row_number := v_row_number + 1;
    v_total := v_total + 1;

    v_code := nullif(btrim(v_row->>'projectCode'), '');
    v_name := nullif(btrim(v_row->>'name'), '');
    v_project_type := nullif(btrim(v_row->>'projectType'), '');
    v_location := nullif(btrim(v_row->>'location'), '');
    v_contract_no := nullif(btrim(v_row->>'contractNo'), '');
    v_contractor := nullif(btrim(v_row->>'contractor'), '');
    v_problem := nullif(btrim(v_row->>'problem'), '');

    if v_code is null then raise exception 'IMPORT_ROW_%_PROJECT_CODE_REQUIRED', v_row_number; end if;
    if v_name is null then raise exception 'IMPORT_ROW_%_PROJECT_NAME_REQUIRED', v_row_number; end if;
    if v_code = any(v_seen_codes) then raise exception 'IMPORT_ROW_%_DUPLICATE_PROJECT_CODE', v_row_number; end if;
    v_seen_codes := array_append(v_seen_codes, v_code);

    begin v_budget := coalesce(nullif(v_row->>'budget','')::numeric, 0); exception when others then raise exception 'IMPORT_ROW_%_INVALID_BUDGET', v_row_number; end;
    begin v_spent := coalesce(nullif(v_row->>'spent','')::numeric, 0); exception when others then raise exception 'IMPORT_ROW_%_INVALID_SPENT', v_row_number; end;
    begin v_planned := coalesce(nullif(v_row->>'plannedProgress','')::numeric, 0); exception when others then raise exception 'IMPORT_ROW_%_INVALID_PLANNED_PROGRESS', v_row_number; end;
    begin v_actual := coalesce(nullif(v_row->>'actualProgress','')::numeric, 0); exception when others then raise exception 'IMPORT_ROW_%_INVALID_ACTUAL_PROGRESS', v_row_number; end;

    if v_budget < 0 or v_spent < 0 then raise exception 'IMPORT_ROW_%_NEGATIVE_AMOUNT', v_row_number; end if;
    if v_planned < 0 or v_planned > 100 or v_actual < 0 or v_actual > 100 then
      raise exception 'IMPORT_ROW_%_PROGRESS_OUT_OF_RANGE', v_row_number;
    end if;

    begin v_start_date := nullif(v_row->>'startDate','')::date; exception when others then raise exception 'IMPORT_ROW_%_INVALID_START_DATE', v_row_number; end;
    begin v_due_date := nullif(v_row->>'dueDate','')::date; exception when others then raise exception 'IMPORT_ROW_%_INVALID_DUE_DATE', v_row_number; end;
    if v_start_date is not null and v_due_date is not null and v_start_date > v_due_date then
      raise exception 'IMPORT_ROW_%_INVALID_DATE_ORDER', v_row_number;
    end if;

    v_status := coalesce(nullif(btrim(v_row->>'status'), ''), 'NOT_STARTED');
    if v_status not in ('NOT_STARTED','IN_PROGRESS','WAITING_REVIEW','COMPLETED','BLOCKED') then
      raise exception 'IMPORT_ROW_%_INVALID_STATUS', v_row_number;
    end if;
    if v_status = 'COMPLETED' and v_actual <> 100 then
      raise exception 'IMPORT_ROW_%_COMPLETED_PROGRESS_MISMATCH', v_row_number;
    end if;

    if v_spent > v_budget and v_budget > 0 then
      v_warning_count := v_warning_count + 1;
    end if;

    if v_row ? 'ownerUserId' and nullif(v_row->>'ownerUserId','') is not null then
      begin v_owner_user_id := (v_row->>'ownerUserId')::uuid; exception when others then raise exception 'IMPORT_ROW_%_INVALID_OWNER', v_row_number; end;
      select * into v_owner
      from public.organization_memberships
      where organization_id = p_organization_id
        and user_id = v_owner_user_id
        and active = true
        and department_id = p_department_id
        and role in ('DIRECTOR','OFFICER');
      if not found then raise exception 'IMPORT_ROW_%_OWNER_NOT_ALLOWED', v_row_number; end if;
    else
      v_owner_user_id := null;
    end if;

    if exists (
      select 1 from public.projects p
      where p.organization_id = p_organization_id and p.project_code = v_code
    ) then raise exception 'IMPORT_ROW_%_PROJECT_CODE_EXISTS', v_row_number; end if;
  end loop;

  if v_warning_count > 0 and not p_confirm_warnings then
    raise exception 'WARNING_CONFIRMATION_REQUIRED';
  end if;

  insert into public.import_batches(
    organization_id, department_id, filename, total_rows, valid_rows, error_rows,
    warning_count, status, created_by_user_id, committed_at
  ) values (
    p_organization_id, p_department_id, btrim(p_filename), v_total, v_total, 0,
    v_warning_count, 'COMMITTED', v_user_id, now()
  ) returning * into v_batch;

  -- Persistence pass. Function execution is one database transaction; any failure rolls everything back.
  v_row_number := 0;
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_row_number := v_row_number + 1;
    v_code := btrim(v_row->>'projectCode');
    v_name := btrim(v_row->>'name');
    v_project_type := nullif(btrim(v_row->>'projectType'), '');
    v_location := nullif(btrim(v_row->>'location'), '');
    v_contract_no := nullif(btrim(v_row->>'contractNo'), '');
    v_contractor := nullif(btrim(v_row->>'contractor'), '');
    v_problem := nullif(btrim(v_row->>'problem'), '');
    v_budget := coalesce(nullif(v_row->>'budget','')::numeric, 0);
    v_spent := coalesce(nullif(v_row->>'spent','')::numeric, 0);
    v_planned := coalesce(nullif(v_row->>'plannedProgress','')::numeric, 0);
    v_actual := coalesce(nullif(v_row->>'actualProgress','')::numeric, 0);
    v_start_date := nullif(v_row->>'startDate','')::date;
    v_due_date := nullif(v_row->>'dueDate','')::date;
    v_status := coalesce(nullif(btrim(v_row->>'status'), ''), 'NOT_STARTED');
    v_owner_user_id := case when nullif(v_row->>'ownerUserId','') is null then null else (v_row->>'ownerUserId')::uuid end;

    insert into public.projects(
      organization_id, department_id, project_code, project_type, name, owner_user_id,
      location_text, contract_no, contractor_name, budget_amount, spent_amount,
      planned_progress, actual_progress, start_date, due_date, status, problem_summary,
      created_by_user_id, last_updated_at
    ) values (
      p_organization_id, p_department_id, v_code, v_project_type, v_name, v_owner_user_id,
      v_location, v_contract_no, v_contractor, v_budget, v_spent,
      v_planned, v_actual, v_start_date, v_due_date, v_status, v_problem,
      v_user_id, now()
    ) returning * into v_project;

    insert into public.audit_events(
      organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, metadata_json
    ) values (
      p_organization_id, p_department_id, v_user_id, 'PROJECT_CREATED', 'PROJECT', v_project.id::text, now(), p_request_id,
      jsonb_build_object(
        'projectId', v_project.id::text,
        'importBatchId', v_batch.id::text,
        'changedFields', jsonb_build_array('created'),
        'source', 'WORK_TRACKING_IMPORT_RPC'
      )
    );
  end loop;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, metadata_json
  ) values (
    p_organization_id, p_department_id, v_user_id, 'IMPORT_COMMITTED', 'IMPORT_BATCH', v_batch.id::text, now(), p_request_id,
    jsonb_build_object(
      'importBatchId', v_batch.id::text,
      'recordCount', v_total,
      'source', 'WORK_TRACKING_IMPORT_RPC'
    )
  );

  return v_batch;
end;
$$;

revoke all on function public.commit_project_import(uuid,uuid,text,jsonb,boolean,text) from public, anon;
grant execute on function public.commit_project_import(uuid,uuid,text,jsonb,boolean,text) to authenticated;
