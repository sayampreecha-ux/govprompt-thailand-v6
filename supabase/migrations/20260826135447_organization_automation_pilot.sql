create extension if not exists pg_cron;

create schema if not exists private;

create table public.automation_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  department_id uuid null,
  name text not null check (char_length(btrim(name)) between 3 and 120),
  workflow_type text not null check (workflow_type in ('PROJECT_DAILY_BRIEF','DEADLINE_WATCH','TASK_WEEKLY_SUMMARY')),
  cadence text not null check (cadence in ('DAILY','WEEKLY')),
  run_time time without time zone not null default '07:30',
  day_of_week integer null check (day_of_week between 1 and 7),
  timezone text not null default 'Asia/Bangkok' check (timezone = 'Asia/Bangkok'),
  output_format_id text not null default 'easy-summary' check (
    output_format_id in (
      'easy-summary','step-by-step','timeline','comparison','workflow',
      'checklist','do-dont','framework','key-insights','quick-guide'
    )
  ),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED')),
  requires_human_approval boolean not null default true check (requires_human_approval = true),
  next_run_at timestamptz null,
  last_run_at timestamptz null,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_definitions_cadence_day_check check (
    (cadence = 'DAILY' and day_of_week is null)
    or (cadence = 'WEEKLY' and day_of_week is not null)
  ),
  constraint automation_definitions_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id)
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automation_definitions(id),
  organization_id uuid not null references public.organizations(id),
  department_id uuid null,
  workflow_type text not null check (workflow_type in ('PROJECT_DAILY_BRIEF','DEADLINE_WATCH','TASK_WEEKLY_SUMMARY')),
  output_format_id text not null check (
    output_format_id in (
      'easy-summary','step-by-step','timeline','comparison','workflow',
      'checklist','do-dont','framework','key-insights','quick-guide'
    )
  ),
  trigger_type text not null check (trigger_type in ('SCHEDULED','MANUAL')),
  status text not null default 'WAITING_APPROVAL' check (
    status in ('WAITING_APPROVAL','APPROVED','REJECTED','FAILED')
  ),
  scheduled_for timestamptz not null,
  generated_at timestamptz not null default now(),
  source_snapshot jsonb not null default '{}'::jsonb,
  draft_output text not null,
  reviewed_by_user_id uuid null references auth.users(id),
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_runs_org_department_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id)
);

create unique index automation_runs_scheduled_once
  on public.automation_runs (automation_id, scheduled_for)
  where trigger_type = 'SCHEDULED';
create index automation_definitions_due_idx
  on public.automation_definitions (status, next_run_at)
  where status = 'ACTIVE';
create index automation_definitions_scope_idx
  on public.automation_definitions (organization_id, department_id, created_at desc);
create index automation_runs_scope_status_idx
  on public.automation_runs (organization_id, department_id, status, generated_at desc);

alter table public.automation_definitions enable row level security;
alter table public.automation_runs enable row level security;

revoke all on table public.automation_definitions from anon, authenticated;
revoke all on table public.automation_runs from anon, authenticated;
grant select on table public.automation_definitions to authenticated;
grant select on table public.automation_runs to authenticated;
grant all on table public.automation_definitions to service_role;
grant all on table public.automation_runs to service_role;

create policy automation_definitions_select_scope
on public.automation_definitions
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = automation_definitions.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and (
        m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
        or (
          m.role in ('DIRECTOR','OFFICER')
          and m.department_id = automation_definitions.department_id
        )
      )
  )
);

create policy automation_runs_select_scope
on public.automation_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = automation_runs.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and (
        m.role in ('ORG_ADMIN','EXECUTIVE','AUDITOR')
        or (
          m.role in ('DIRECTOR','OFFICER')
          and m.department_id = automation_runs.department_id
        )
      )
  )
);

create or replace function private.next_automation_run(
  p_cadence text,
  p_run_time time without time zone,
  p_day_of_week integer,
  p_timezone text,
  p_after timestamptz
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_local_after timestamp without time zone;
  v_candidate timestamp without time zone;
  v_days integer;
begin
  if p_cadence not in ('DAILY','WEEKLY') then raise exception 'INVALID_CADENCE'; end if;
  if p_timezone <> 'Asia/Bangkok' then raise exception 'INVALID_TIMEZONE'; end if;
  v_local_after := coalesce(p_after, now()) at time zone p_timezone;

  if p_cadence = 'DAILY' then
    v_candidate := v_local_after::date + p_run_time;
    if v_candidate <= v_local_after then v_candidate := v_candidate + interval '1 day'; end if;
  else
    if p_day_of_week is null or p_day_of_week < 1 or p_day_of_week > 7 then
      raise exception 'INVALID_DAY_OF_WEEK';
    end if;
    v_days := mod(p_day_of_week - extract(isodow from v_local_after)::integer + 7, 7);
    v_candidate := v_local_after::date + v_days + p_run_time;
    if v_candidate <= v_local_after then v_candidate := v_candidate + interval '7 days'; end if;
  end if;

  return v_candidate at time zone p_timezone;
end;
$function$;

create or replace function private.build_automation_report(p_automation_id uuid)
returns table(source_snapshot jsonb, draft_output text)
language plpgsql
set search_path = ''
as $function$
declare
  v_definition public.automation_definitions%rowtype;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_project_total bigint := 0;
  v_project_completed bigint := 0;
  v_project_blocked bigint := 0;
  v_project_overdue bigint := 0;
  v_budget numeric := 0;
  v_spent numeric := 0;
  v_task_total bigint := 0;
  v_task_completed bigint := 0;
  v_task_urgent bigint := 0;
  v_task_overdue bigint := 0;
  v_project_lines text := '';
  v_task_lines text := '';
  v_heading text;
begin
  select * into v_definition
  from public.automation_definitions
  where id = p_automation_id;
  if not found then raise exception 'AUTOMATION_NOT_FOUND'; end if;

  select
    count(*),
    count(*) filter (where p.status = 'COMPLETED'),
    count(*) filter (where p.status = 'BLOCKED'),
    count(*) filter (where p.status <> 'COMPLETED' and p.due_date < v_today),
    coalesce(sum(p.budget_amount), 0),
    coalesce(sum(p.spent_amount), 0)
  into v_project_total, v_project_completed, v_project_blocked, v_project_overdue, v_budget, v_spent
  from public.projects p
  where p.organization_id = v_definition.organization_id
    and (v_definition.department_id is null or p.department_id = v_definition.department_id);

  select
    count(*),
    count(*) filter (where t.status = 'COMPLETED'),
    count(*) filter (where t.priority = 'URGENT' and t.status <> 'COMPLETED'),
    count(*) filter (
      where t.status <> 'COMPLETED'
        and t.due_at is not null
        and (t.due_at at time zone 'Asia/Bangkok')::date < v_today
    )
  into v_task_total, v_task_completed, v_task_urgent, v_task_overdue
  from public.tasks t
  where t.organization_id = v_definition.organization_id
    and (v_definition.department_id is null or t.department_id = v_definition.department_id);

  select coalesce(string_agg(item.line, E'\n'), '- ไม่พบรายการในเงื่อนไขนี้')
  into v_project_lines
  from (
    select format(
      '- %s | สถานะ %s | กำหนด %s | ผลจริง %s%%',
      p.name,
      p.status,
      coalesce(to_char(p.due_date, 'DD/MM/YYYY'), '-'),
      p.actual_progress
    ) as line
    from public.projects p
    where p.organization_id = v_definition.organization_id
      and (v_definition.department_id is null or p.department_id = v_definition.department_id)
      and p.status <> 'COMPLETED'
      and (
        p.status = 'BLOCKED'
        or p.due_date < v_today
        or p.due_date between v_today and (v_today + 14)
      )
    order by p.due_date nulls last, p.name
    limit 12
  ) item;

  select coalesce(string_agg(item.line, E'\n'), '- ไม่พบรายการในเงื่อนไขนี้')
  into v_task_lines
  from (
    select format(
      '- %s | %s | %s | กำหนด %s',
      t.title,
      t.status,
      t.priority,
      coalesce(to_char(t.due_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'), '-')
    ) as line
    from public.tasks t
    where t.organization_id = v_definition.organization_id
      and (v_definition.department_id is null or t.department_id = v_definition.department_id)
      and t.status <> 'COMPLETED'
      and (
        t.priority in ('HIGH','URGENT')
        or (
          t.due_at is not null
          and (t.due_at at time zone 'Asia/Bangkok')::date <= (v_today + 7)
        )
      )
    order by
      case t.priority when 'URGENT' then 1 when 'HIGH' then 2 else 3 end,
      t.due_at nulls last,
      t.title
    limit 15
  ) item;

  v_heading := case v_definition.workflow_type
    when 'PROJECT_DAILY_BRIEF' then 'สรุปโครงการประจำวัน'
    when 'DEADLINE_WATCH' then 'รายงานเฝ้าระวังงานใกล้กำหนด'
    else 'สรุปงานค้างรายสัปดาห์'
  end;

  source_snapshot := jsonb_build_object(
    'generatedAt', now(),
    'timezone', 'Asia/Bangkok',
    'organizationId', v_definition.organization_id,
    'departmentId', v_definition.department_id,
    'workflowType', v_definition.workflow_type,
    'projects', jsonb_build_object(
      'total', v_project_total,
      'completed', v_project_completed,
      'blocked', v_project_blocked,
      'overdue', v_project_overdue,
      'budgetAmount', v_budget,
      'spentAmount', v_spent
    ),
    'tasks', jsonb_build_object(
      'total', v_task_total,
      'completed', v_task_completed,
      'urgentOpen', v_task_urgent,
      'overdue', v_task_overdue
    )
  );

  draft_output :=
    v_heading || E'\n'
    || 'สถานะ: ฉบับรอตรวจสอบโดยเจ้าหน้าที่' || E'\n'
    || 'วันที่สร้าง: ' || to_char(now() at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || ' น.' || E'\n'
    || 'รูปแบบการนำเสนอ: ' || v_definition.output_format_id || E'\n\n'
    || '1. ภาพรวมโครงการ' || E'\n'
    || '- โครงการทั้งหมด: ' || v_project_total || E'\n'
    || '- เสร็จสิ้น: ' || v_project_completed || E'\n'
    || '- ติดปัญหา: ' || v_project_blocked || E'\n'
    || '- เกินกำหนด: ' || v_project_overdue || E'\n'
    || '- วงเงินรวม: ' || to_char(v_budget, 'FM999G999G999G999G990D00') || ' บาท' || E'\n'
    || '- เบิกจ่าย/ใช้จ่าย: ' || to_char(v_spent, 'FM999G999G999G999G990D00') || ' บาท' || E'\n\n'
    || '2. งานที่ต้องจับตา' || E'\n' || v_project_lines || E'\n\n'
    || '3. ภาพรวมงานย่อย' || E'\n'
    || '- งานทั้งหมด: ' || v_task_total || E'\n'
    || '- เสร็จสิ้น: ' || v_task_completed || E'\n'
    || '- เร่งด่วนที่ยังไม่เสร็จ: ' || v_task_urgent || E'\n'
    || '- เกินกำหนด: ' || v_task_overdue || E'\n\n'
    || '4. งานที่ควรติดตาม' || E'\n' || v_task_lines || E'\n\n'
    || '5. จุดตรวจสอบก่อนใช้' || E'\n'
    || '- ตรวจชื่อโครงการ สถานะ วันกำหนด และตัวเลขกับหลักฐานต้นทาง' || E'\n'
    || '- หากข้อมูลยังไม่อัปเดต ให้ระบุ [ต้องตรวจสอบ/เพิ่มเติม]' || E'\n'
    || '- รายงานนี้ไม่ใช่คำสั่งหรือการอนุมัติของผู้มีอำนาจ' || E'\n\n'
    || 'แหล่งข้อมูล: GovPrompt Work Tracking ณ เวลาที่สร้างรายงาน';

  return next;
end;
$function$;

create or replace function private.generate_automation_run(
  p_automation_id uuid,
  p_trigger_type text,
  p_scheduled_for timestamptz,
  p_request_id text default null
)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_definition public.automation_definitions%rowtype;
  v_snapshot jsonb;
  v_draft text;
  v_run_id uuid;
begin
  if p_trigger_type not in ('SCHEDULED','MANUAL') then raise exception 'INVALID_TRIGGER_TYPE'; end if;

  select * into v_definition
  from public.automation_definitions
  where id = p_automation_id
  for update;
  if not found then raise exception 'AUTOMATION_NOT_FOUND'; end if;

  select report.source_snapshot, report.draft_output
  into v_snapshot, v_draft
  from private.build_automation_report(v_definition.id) report;

  insert into public.automation_runs(
    automation_id, organization_id, department_id, workflow_type, output_format_id,
    trigger_type, status, scheduled_for, source_snapshot, draft_output
  ) values (
    v_definition.id, v_definition.organization_id, v_definition.department_id,
    v_definition.workflow_type, v_definition.output_format_id,
    p_trigger_type, 'WAITING_APPROVAL', coalesce(p_scheduled_for, now()), v_snapshot, v_draft
  )
  returning id into v_run_id;

  update public.automation_definitions
  set last_run_at = now(), updated_at = now()
  where id = v_definition.id;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type,
    entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_definition.organization_id, v_definition.department_id, v_definition.created_by_user_id,
    'AUTOMATION_RUN_GENERATED', 'AUTOMATION_RUN', v_run_id::text,
    now(), p_request_id,
    jsonb_build_object(
      'automationId', v_definition.id::text,
      'triggerType', p_trigger_type,
      'status', 'WAITING_APPROVAL',
      'source', 'AUTOMATION_PILOT'
    )
  );

  return v_run_id;
end;
$function$;

create or replace function private.process_due_automations()
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_definition public.automation_definitions%rowtype;
  v_count integer := 0;
begin
  for v_definition in
    select *
    from public.automation_definitions
    where status = 'ACTIVE'
      and next_run_at is not null
      and next_run_at <= now()
    order by next_run_at
    for update skip locked
  loop
    perform private.generate_automation_run(
      v_definition.id,
      'SCHEDULED',
      v_definition.next_run_at,
      null
    );

    update public.automation_definitions
    set next_run_at = private.next_automation_run(
          v_definition.cadence,
          v_definition.run_time,
          v_definition.day_of_week,
          v_definition.timezone,
          greatest(now(), v_definition.next_run_at + interval '1 second')
        ),
        updated_at = now()
    where id = v_definition.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

create or replace function public.create_automation_definition(
  p_organization_id uuid,
  p_department_id uuid,
  p_name text,
  p_workflow_type text,
  p_cadence text,
  p_run_time time without time zone,
  p_day_of_week integer,
  p_output_format_id text,
  p_activate boolean default false,
  p_request_id text default null
)
returns public.automation_definitions
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_membership public.organization_memberships%rowtype;
  v_definition public.automation_definitions%rowtype;
  v_status text := case when coalesce(p_activate, false) then 'ACTIVE' else 'DRAFT' end;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_organization_id is null then raise exception 'ORGANIZATION_REQUIRED'; end if;
  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) not between 3 and 120 then raise exception 'INVALID_NAME'; end if;
  if p_workflow_type not in ('PROJECT_DAILY_BRIEF','DEADLINE_WATCH','TASK_WEEKLY_SUMMARY') then raise exception 'INVALID_WORKFLOW_TYPE'; end if;
  if p_cadence not in ('DAILY','WEEKLY') then raise exception 'INVALID_CADENCE'; end if;
  if p_run_time is null then raise exception 'RUN_TIME_REQUIRED'; end if;
  if (p_cadence = 'DAILY' and p_day_of_week is not null)
     or (p_cadence = 'WEEKLY' and (p_day_of_week is null or p_day_of_week not between 1 and 7))
  then raise exception 'INVALID_DAY_OF_WEEK'; end if;
  if p_output_format_id not in (
    'easy-summary','step-by-step','timeline','comparison','workflow',
    'checklist','do-dont','framework','key-insights','quick-guide'
  ) then raise exception 'INVALID_OUTPUT_FORMAT'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = p_organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  if not (
    (v_membership.role = 'ORG_ADMIN')
    or (
      v_membership.role = 'DIRECTOR'
      and p_department_id is not null
      and v_membership.department_id = p_department_id
    )
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  if p_department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department_id
      and d.organization_id = p_organization_id
      and d.active = true
  ) then raise exception 'DEPARTMENT_NOT_ALLOWED'; end if;

  insert into public.automation_definitions(
    organization_id, department_id, name, workflow_type, cadence, run_time,
    day_of_week, timezone, output_format_id, status, requires_human_approval,
    next_run_at, created_by_user_id
  ) values (
    p_organization_id, p_department_id, btrim(p_name), p_workflow_type, p_cadence,
    p_run_time, p_day_of_week, 'Asia/Bangkok', p_output_format_id, v_status, true,
    case when v_status = 'ACTIVE' then
      private.next_automation_run(p_cadence, p_run_time, p_day_of_week, 'Asia/Bangkok', now())
    else null end,
    v_user_id
  )
  returning * into v_definition;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type,
    entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_definition.organization_id, v_definition.department_id, v_user_id,
    'AUTOMATION_CREATED', 'AUTOMATION', v_definition.id::text,
    now(), p_request_id,
    jsonb_build_object(
      'workflowType', v_definition.workflow_type,
      'cadence', v_definition.cadence,
      'status', v_definition.status,
      'requiresHumanApproval', true,
      'source', 'AUTOMATION_PILOT_RPC'
    )
  );

  return v_definition;
end;
$function$;

create or replace function public.set_automation_definition_status(
  p_automation_id uuid,
  p_status text,
  p_request_id text default null
)
returns public.automation_definitions
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_definition public.automation_definitions%rowtype;
  v_membership public.organization_memberships%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_status not in ('ACTIVE','PAUSED') then raise exception 'INVALID_STATUS'; end if;

  select * into v_definition
  from public.automation_definitions
  where id = p_automation_id
  for update;
  if not found then raise exception 'AUTOMATION_NOT_FOUND'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_definition.organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (
      v_membership.role = 'DIRECTOR'
      and v_membership.department_id = v_definition.department_id
    )
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  if v_definition.status = p_status then return v_definition; end if;

  update public.automation_definitions
  set status = p_status,
      next_run_at = case when p_status = 'ACTIVE'
        then private.next_automation_run(cadence, run_time, day_of_week, timezone, now())
        else null
      end,
      updated_at = now()
  where id = v_definition.id
  returning * into v_definition;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type,
    entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_definition.organization_id, v_definition.department_id, v_user_id,
    'AUTOMATION_STATUS_CHANGED', 'AUTOMATION', v_definition.id::text,
    now(), p_request_id,
    jsonb_build_object('status', p_status, 'source', 'AUTOMATION_PILOT_RPC')
  );

  return v_definition;
end;
$function$;

create or replace function public.run_automation_now(
  p_automation_id uuid,
  p_request_id text default null
)
returns public.automation_runs
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_definition public.automation_definitions%rowtype;
  v_membership public.organization_memberships%rowtype;
  v_run public.automation_runs%rowtype;
  v_run_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_definition from public.automation_definitions where id = p_automation_id;
  if not found then raise exception 'AUTOMATION_NOT_FOUND'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_definition.organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  if not (
    v_membership.role = 'ORG_ADMIN'
    or (
      v_membership.role = 'DIRECTOR'
      and v_membership.department_id = v_definition.department_id
    )
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  v_run_id := private.generate_automation_run(
    v_definition.id, 'MANUAL', now(), p_request_id
  );
  select * into v_run from public.automation_runs where id = v_run_id;
  return v_run;
end;
$function$;

create or replace function public.review_automation_run(
  p_run_id uuid,
  p_decision text,
  p_note text default null,
  p_request_id text default null
)
returns public.automation_runs
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_run public.automation_runs%rowtype;
  v_membership public.organization_memberships%rowtype;
  v_next_status text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_decision not in ('APPROVE','REJECT') then raise exception 'INVALID_DECISION'; end if;
  if p_decision = 'REJECT' and nullif(btrim(p_note), '') is null then raise exception 'REJECTION_NOTE_REQUIRED'; end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception 'NOTE_TOO_LONG'; end if;

  select * into v_run
  from public.automation_runs
  where id = p_run_id
  for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  if v_run.status <> 'WAITING_APPROVAL' then raise exception 'RUN_ALREADY_REVIEWED'; end if;

  select * into v_membership
  from public.organization_memberships
  where organization_id = v_run.organization_id
    and user_id = v_user_id
    and active = true;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  if not (
    v_membership.role in ('ORG_ADMIN','EXECUTIVE')
    or (
      v_membership.role = 'DIRECTOR'
      and v_membership.department_id = v_run.department_id
    )
  ) then raise exception 'ROLE_FORBIDDEN'; end if;

  v_next_status := case when p_decision = 'APPROVE' then 'APPROVED' else 'REJECTED' end;
  update public.automation_runs
  set status = v_next_status,
      reviewed_by_user_id = v_user_id,
      reviewed_at = now(),
      review_note = nullif(btrim(p_note), ''),
      updated_at = now()
  where id = v_run.id
  returning * into v_run;

  insert into public.audit_events(
    organization_id, department_id, actor_user_id, action, entity_type,
    entity_id, occurred_at, request_id, metadata_json
  ) values (
    v_run.organization_id, v_run.department_id, v_user_id,
    case when v_next_status = 'APPROVED' then 'AUTOMATION_RUN_APPROVED' else 'AUTOMATION_RUN_REJECTED' end,
    'AUTOMATION_RUN', v_run.id::text, now(), p_request_id,
    jsonb_build_object(
      'automationId', v_run.automation_id::text,
      'status', v_next_status,
      'source', 'AUTOMATION_PILOT_RPC'
    )
  );

  return v_run;
end;
$function$;

revoke all on function public.create_automation_definition(
  uuid, uuid, text, text, text, time without time zone, integer, text, boolean, text
) from public, anon;
revoke all on function public.set_automation_definition_status(uuid, text, text) from public, anon;
revoke all on function public.run_automation_now(uuid, text) from public, anon;
revoke all on function public.review_automation_run(uuid, text, text, text) from public, anon;

grant execute on function public.create_automation_definition(
  uuid, uuid, text, text, text, time without time zone, integer, text, boolean, text
) to authenticated;
grant execute on function public.set_automation_definition_status(uuid, text, text) to authenticated;
grant execute on function public.run_automation_now(uuid, text) to authenticated;
grant execute on function public.review_automation_run(uuid, text, text, text) to authenticated;

revoke all on function private.next_automation_run(
  text, time without time zone, integer, text, timestamptz
) from public, anon, authenticated;
revoke all on function private.build_automation_report(uuid) from public, anon, authenticated;
revoke all on function private.generate_automation_run(uuid, text, timestamptz, text) from public, anon, authenticated;
revoke all on function private.process_due_automations() from public, anon, authenticated;

do $block$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'govprompt-automation-pilot';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'govprompt-automation-pilot',
    '*/5 * * * *',
    'select private.process_due_automations();'
  );
end;
$block$;

notify pgrst, 'reload schema';

