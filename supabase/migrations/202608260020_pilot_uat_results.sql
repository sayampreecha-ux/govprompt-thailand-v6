create table if not exists public.pilot_uat_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ORG_ADMIN','EXECUTIVE','DIRECTOR','OFFICER','AUDITOR')),
  test_key text not null check (test_key in ('AUTH_LOGIN','DASHBOARD_READ','COMMAND_CENTER','PROJECT_OPERATIONS','TASK_OPERATIONS','ASSIGNMENT','CSV_IMPORT','EXPORT_SNAPSHOT','ROLE_BOUNDARY')),
  result text not null check (result in ('PASS','FAIL','BLOCKED')),
  notes text null check (char_length(coalesce(notes,'')) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_uat_results_role_department_check check (
    (role in ('ORG_ADMIN','EXECUTIVE','AUDITOR') and department_id is null)
    or (role in ('DIRECTOR','OFFICER') and department_id is not null)
  ),
  constraint pilot_uat_results_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id),
  constraint pilot_uat_results_unique unique (organization_id, user_id, test_key)
);

alter table public.pilot_uat_results enable row level security;
revoke all on public.pilot_uat_results from public, anon, authenticated;

drop function if exists public.submit_work_pilot_uat(uuid,text,text,text);
create function public.submit_work_pilot_uat(
  p_organization_id uuid,
  p_test_key text,
  p_result text,
  p_notes text default null
)
returns public.pilot_uat_results
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_membership public.organization_memberships%rowtype;
  v_row public.pilot_uat_results%rowtype;
  v_notes text := nullif(btrim(p_notes), '');
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null then raise exception 'ORGANIZATION_REQUIRED'; end if;
  if p_test_key not in ('AUTH_LOGIN','DASHBOARD_READ','COMMAND_CENTER','PROJECT_OPERATIONS','TASK_OPERATIONS','ASSIGNMENT','CSV_IMPORT','EXPORT_SNAPSHOT','ROLE_BOUNDARY') then
    raise exception 'INVALID_UAT_TEST';
  end if;
  if p_result not in ('PASS','FAIL','BLOCKED') then raise exception 'INVALID_UAT_RESULT'; end if;
  if char_length(coalesce(v_notes,'')) > 1000 then raise exception 'UAT_NOTE_TOO_LONG'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = p_organization_id
    and user_id = v_uid
    and active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  insert into public.pilot_uat_results(
    organization_id, department_id, user_id, role, test_key, result, notes, created_at, updated_at
  ) values (
    p_organization_id, v_membership.department_id, v_uid, v_membership.role,
    p_test_key, p_result, v_notes, now(), now()
  )
  on conflict (organization_id, user_id, test_key)
  do update set
    department_id = excluded.department_id,
    role = excluded.role,
    result = excluded.result,
    notes = excluded.notes,
    updated_at = now()
  returning * into v_row;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type, entity_id, occurred_at, metadata_json
  ) values (
    p_organization_id, v_membership.department_id, v_uid,
    'UAT_RESULT_SUBMITTED', 'PILOT_UAT', v_row.id::text, now(),
    jsonb_build_object('testKey', p_test_key, 'result', p_result, 'role', v_membership.role, 'source', 'WORK_TRACKING_UAT_RPC')
  );

  return v_row;
end;
$$;

drop function if exists public.get_my_work_pilot_uat(uuid);
create function public.get_my_work_pilot_uat(p_organization_id uuid)
returns table(test_key text, result text, notes text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = v_uid and m.active = true
  ) then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  return query
  select r.test_key, r.result, r.notes, r.updated_at
  from public.pilot_uat_results r
  where r.organization_id = p_organization_id and r.user_id = v_uid
  order by r.test_key;
end;
$$;

drop function if exists public.get_work_pilot_uat_summary(uuid);
create function public.get_work_pilot_uat_summary(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select m.role into v_role
  from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = v_uid and m.active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if v_role not in ('ORG_ADMIN','EXECUTIVE') then raise exception 'ROLE_FORBIDDEN'; end if;

  select jsonb_build_object(
    'memberCounts', coalesce((
      select jsonb_agg(jsonb_build_object('role',x.role,'count',x.member_count) order by x.role)
      from (
        select m.role, count(*)::int as member_count
        from public.organization_memberships m
        where m.organization_id = p_organization_id and m.active = true
        group by m.role
      ) x
    ), '[]'::jsonb),
    'resultCounts', coalesce((
      select jsonb_agg(jsonb_build_object('role',x.role,'result',x.result,'count',x.result_count) order by x.role,x.result)
      from (
        select r.role, r.result, count(*)::int as result_count
        from public.pilot_uat_results r
        where r.organization_id = p_organization_id
        group by r.role, r.result
      ) x
    ), '[]'::jsonb),
    'uniqueTesters', (select count(distinct r.user_id)::int from public.pilot_uat_results r where r.organization_id = p_organization_id),
    'submissions', (select count(*)::int from public.pilot_uat_results r where r.organization_id = p_organization_id)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.submit_work_pilot_uat(uuid,text,text,text) from public, anon;
revoke all on function public.get_my_work_pilot_uat(uuid) from public, anon;
revoke all on function public.get_work_pilot_uat_summary(uuid) from public, anon;
grant execute on function public.submit_work_pilot_uat(uuid,text,text,text) to authenticated;
grant execute on function public.get_my_work_pilot_uat(uuid) to authenticated;
grant execute on function public.get_work_pilot_uat_summary(uuid) to authenticated;
