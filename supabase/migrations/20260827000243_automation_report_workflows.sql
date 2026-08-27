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
  v_project_due_7 bigint := 0;
  v_project_due_8_14 bigint := 0;
  v_budget numeric := 0;
  v_spent numeric := 0;
  v_spend_percent numeric := 0;
  v_task_total bigint := 0;
  v_task_completed bigint := 0;
  v_task_not_started bigint := 0;
  v_task_in_progress bigint := 0;
  v_task_waiting_review bigint := 0;
  v_task_blocked bigint := 0;
  v_task_urgent bigint := 0;
  v_task_overdue bigint := 0;
  v_task_due_3 bigint := 0;
  v_task_due_4_7 bigint := 0;
  v_daily_project_lines text := '';
  v_daily_task_lines text := '';
  v_deadline_project_lines text := '';
  v_deadline_task_lines text := '';
  v_weekly_task_lines text := '';
  v_heading text;
  v_format_label text;
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
    count(*) filter (
      where p.status <> 'COMPLETED'
        and p.due_date between v_today and (v_today + 7)
    ),
    count(*) filter (
      where p.status <> 'COMPLETED'
        and p.due_date between (v_today + 8) and (v_today + 14)
    ),
    coalesce(sum(p.budget_amount), 0),
    coalesce(sum(p.spent_amount), 0)
  into
    v_project_total,
    v_project_completed,
    v_project_blocked,
    v_project_overdue,
    v_project_due_7,
    v_project_due_8_14,
    v_budget,
    v_spent
  from public.projects p
  where p.organization_id = v_definition.organization_id
    and (v_definition.department_id is null or p.department_id = v_definition.department_id);

  v_spend_percent := case
    when v_budget > 0 then round((v_spent / v_budget) * 100, 2)
    else 0
  end;

  select
    count(*),
    count(*) filter (where t.status = 'COMPLETED'),
    count(*) filter (where t.status = 'NOT_STARTED'),
    count(*) filter (where t.status = 'IN_PROGRESS'),
    count(*) filter (where t.status = 'WAITING_REVIEW'),
    count(*) filter (where t.status = 'BLOCKED'),
    count(*) filter (where t.priority = 'URGENT' and t.status <> 'COMPLETED'),
    count(*) filter (
      where t.status <> 'COMPLETED'
        and t.due_at is not null
        and (t.due_at at time zone 'Asia/Bangkok')::date < v_today
    ),
    count(*) filter (
      where t.status <> 'COMPLETED'
        and t.due_at is not null
        and (t.due_at at time zone 'Asia/Bangkok')::date between v_today and (v_today + 3)
    ),
    count(*) filter (
      where t.status <> 'COMPLETED'
        and t.due_at is not null
        and (t.due_at at time zone 'Asia/Bangkok')::date between (v_today + 4) and (v_today + 7)
    )
  into
    v_task_total,
    v_task_completed,
    v_task_not_started,
    v_task_in_progress,
    v_task_waiting_review,
    v_task_blocked,
    v_task_urgent,
    v_task_overdue,
    v_task_due_3,
    v_task_due_4_7
  from public.tasks t
  where t.organization_id = v_definition.organization_id
    and (v_definition.department_id is null or t.department_id = v_definition.department_id);

  select coalesce(string_agg(item.line, E'\n'), '- ไม่พบโครงการที่ต้องเร่งติดตาม')
  into v_daily_project_lines
  from (
    select format(
      '- %s | สถานะ %s | กำหนด %s | ผลจริง %s%%',
      regexp_replace(p.name, E'[\n\r]+', ' ', 'g'),
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
    order by
      case when p.status = 'BLOCKED' then 1 when p.due_date < v_today then 2 else 3 end,
      p.due_date nulls last,
      p.name
    limit 12
  ) item;

  select coalesce(string_agg(item.line, E'\n'), '- ไม่พบงานย่อยที่ต้องเร่งติดตาม')
  into v_daily_task_lines
  from (
    select format(
      '- %s | %s | %s | กำหนด %s',
      regexp_replace(t.title, E'[\n\r]+', ' ', 'g'),
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

  select coalesce(string_agg(item.line, E'\n'), '[ ] ไม่พบโครงการใกล้หรือเกินกำหนด')
  into v_deadline_project_lines
  from (
    select format(
      '[ ] %s %s | กำหนด %s | สถานะ %s | ผลจริง %s%%',
      case
        when p.status = 'BLOCKED' then '[ติดปัญหา]'
        when p.due_date < v_today then '[เกินกำหนด]'
        when p.due_date <= v_today + 7 then '[ภายใน 7 วัน]'
        else '[ภายใน 14 วัน]'
      end,
      regexp_replace(p.name, E'[\n\r]+', ' ', 'g'),
      coalesce(to_char(p.due_date, 'DD/MM/YYYY'), '-'),
      p.status,
      p.actual_progress
    ) as line
    from public.projects p
    where p.organization_id = v_definition.organization_id
      and (v_definition.department_id is null or p.department_id = v_definition.department_id)
      and p.status <> 'COMPLETED'
      and (
        p.status = 'BLOCKED'
        or p.due_date <= (v_today + 14)
      )
    order by
      case
        when p.status = 'BLOCKED' then 1
        when p.due_date < v_today then 2
        when p.due_date <= v_today + 7 then 3
        else 4
      end,
      p.due_date nulls last,
      p.name
    limit 20
  ) item;

  select coalesce(string_agg(item.line, E'\n'), '[ ] ไม่พบงานย่อยใกล้หรือเกินกำหนด')
  into v_deadline_task_lines
  from (
    select format(
      '[ ] %s %s | กำหนด %s | %s/%s',
      case
        when t.status = 'BLOCKED' then '[ติดปัญหา]'
        when (t.due_at at time zone 'Asia/Bangkok')::date < v_today then '[เกินกำหนด]'
        when (t.due_at at time zone 'Asia/Bangkok')::date <= v_today + 3 then '[ภายใน 3 วัน]'
        when t.priority = 'URGENT' then '[เร่งด่วน]'
        else '[ภายใน 7 วัน]'
      end,
      regexp_replace(t.title, E'[\n\r]+', ' ', 'g'),
      coalesce(to_char(t.due_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'), '-'),
      t.status,
      t.priority
    ) as line
    from public.tasks t
    where t.organization_id = v_definition.organization_id
      and (v_definition.department_id is null or t.department_id = v_definition.department_id)
      and t.status <> 'COMPLETED'
      and (
        t.status = 'BLOCKED'
        or t.priority = 'URGENT'
        or (
          t.due_at is not null
          and (t.due_at at time zone 'Asia/Bangkok')::date <= (v_today + 7)
        )
      )
    order by
      case
        when t.status = 'BLOCKED' then 1
        when t.due_at is not null and (t.due_at at time zone 'Asia/Bangkok')::date < v_today then 2
        when t.priority = 'URGENT' then 3
        else 4
      end,
      t.due_at nulls last,
      t.title
    limit 25
  ) item;

  select coalesce(string_agg(item.line, E'\n'), '- ไม่พบงานค้าง')
  into v_weekly_task_lines
  from (
    select format(
      '- %s | %s/%s | กำหนด %s',
      regexp_replace(t.title, E'[\n\r]+', ' ', 'g'),
      t.status,
      t.priority,
      coalesce(to_char(t.due_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'), '-')
    ) as line
    from public.tasks t
    where t.organization_id = v_definition.organization_id
      and (v_definition.department_id is null or t.department_id = v_definition.department_id)
      and t.status <> 'COMPLETED'
    order by
      case t.priority when 'URGENT' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,
      case t.status when 'BLOCKED' then 1 when 'WAITING_REVIEW' then 2 else 3 end,
      t.due_at nulls last,
      t.title
    limit 25
  ) item;

  v_heading := case v_definition.workflow_type
    when 'PROJECT_DAILY_BRIEF' then 'สรุปโครงการประจำวัน'
    when 'DEADLINE_WATCH' then 'รายงานเฝ้าระวังงานใกล้กำหนด'
    else 'สรุปงานค้างรายสัปดาห์'
  end;

  v_format_label := case v_definition.output_format_id
    when 'easy-summary' then 'สรุปเข้าใจง่าย'
    when 'step-by-step' then 'Step-by-Step'
    when 'timeline' then 'Timeline'
    when 'comparison' then 'เปรียบเทียบ'
    when 'workflow' then 'Workflow'
    when 'checklist' then 'Checklist'
    when 'do-dont' then 'Do & Don''t'
    when 'framework' then 'Framework'
    when 'key-insights' then 'ตัวเลขและ Key Insights'
    else 'คู่มือฉบับย่อ'
  end;

  source_snapshot := jsonb_build_object(
    'reportVersion', 2,
    'generatedAt', now(),
    'timezone', 'Asia/Bangkok',
    'organizationId', v_definition.organization_id,
    'departmentId', v_definition.department_id,
    'workflowType', v_definition.workflow_type,
    'outputFormatId', v_definition.output_format_id,
    'projects', jsonb_build_object(
      'total', v_project_total,
      'completed', v_project_completed,
      'blocked', v_project_blocked,
      'overdue', v_project_overdue,
      'dueWithin7Days', v_project_due_7,
      'dueDays8To14', v_project_due_8_14,
      'budgetAmount', v_budget,
      'spentAmount', v_spent,
      'spentPercent', v_spend_percent
    ),
    'tasks', jsonb_build_object(
      'total', v_task_total,
      'completed', v_task_completed,
      'notStarted', v_task_not_started,
      'inProgress', v_task_in_progress,
      'waitingReview', v_task_waiting_review,
      'blocked', v_task_blocked,
      'urgentOpen', v_task_urgent,
      'overdue', v_task_overdue,
      'dueWithin3Days', v_task_due_3,
      'dueDays4To7', v_task_due_4_7
    )
  );

  draft_output :=
    v_heading || E'\n'
    || 'สถานะ: ฉบับรอตรวจสอบโดยเจ้าหน้าที่' || E'\n'
    || 'วันที่สร้าง: ' || to_char(now() at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || ' น.' || E'\n'
    || 'รูปแบบการนำเสนอ: ' || v_format_label || E'\n\n'
    || case v_definition.workflow_type
      when 'PROJECT_DAILY_BRIEF' then
        '1. ภาพรวมวันนี้' || E'\n'
        || '- โครงการทั้งหมด: ' || v_project_total || E'\n'
        || '- เสร็จสิ้น: ' || v_project_completed || E'\n'
        || '- ติดปัญหา: ' || v_project_blocked || E'\n'
        || '- เกินกำหนด: ' || v_project_overdue || E'\n'
        || '- วงเงินรวม: ' || to_char(v_budget, 'FM999G999G999G999G990D00') || ' บาท' || E'\n'
        || '- เบิกจ่าย/ใช้จ่าย: ' || to_char(v_spent, 'FM999G999G999G999G990D00') || ' บาท (' || v_spend_percent || '%)' || E'\n\n'
        || '2. โครงการที่ต้องจับตา' || E'\n' || v_daily_project_lines || E'\n\n'
        || '3. งานย่อยที่ต้องติดตาม' || E'\n' || v_daily_task_lines
      when 'DEADLINE_WATCH' then
        '1. สัญญาณเตือน' || E'\n'
        || '- โครงการเกินกำหนด: ' || v_project_overdue || E'\n'
        || '- โครงการครบกำหนดภายใน 7 วัน: ' || v_project_due_7 || E'\n'
        || '- โครงการครบกำหนดวันที่ 8–14: ' || v_project_due_8_14 || E'\n'
        || '- งานย่อยเกินกำหนด: ' || v_task_overdue || E'\n'
        || '- งานย่อยครบกำหนดภายใน 3 วัน: ' || v_task_due_3 || E'\n'
        || '- งานย่อยครบกำหนดวันที่ 4–7: ' || v_task_due_4_7 || E'\n\n'
        || '2. Checklist โครงการ' || E'\n' || v_deadline_project_lines || E'\n\n'
        || '3. Checklist งานย่อย' || E'\n' || v_deadline_task_lines || E'\n\n'
        || '4. การติดตามที่ควรทำ' || E'\n'
        || '[ ] ยืนยันข้อมูลกับผู้รับผิดชอบ' || E'\n'
        || '[ ] ระบุสาเหตุและแนวทางแก้ไขของรายการเกินกำหนด' || E'\n'
        || '[ ] เสนอผู้มีอำนาจเฉพาะรายการที่ตรวจหลักฐานครบแล้ว'
      else
        '1. Key Insights ประจำสัปดาห์' || E'\n'
        || '- งานทั้งหมด: ' || v_task_total || E'\n'
        || '- เสร็จสิ้น: ' || v_task_completed || E'\n'
        || '- ยังไม่เริ่ม: ' || v_task_not_started || E'\n'
        || '- กำลังดำเนินการ: ' || v_task_in_progress || E'\n'
        || '- รอตรวจ: ' || v_task_waiting_review || E'\n'
        || '- ติดปัญหา: ' || v_task_blocked || E'\n'
        || '- เร่งด่วนที่ยังไม่เสร็จ: ' || v_task_urgent || E'\n'
        || '- เกินกำหนด: ' || v_task_overdue || E'\n\n'
        || '2. รายการงานค้างเรียงตามความสำคัญ' || E'\n' || v_weekly_task_lines || E'\n\n'
        || '3. โครงการที่อาจกระทบสัปดาห์ถัดไป' || E'\n' || v_daily_project_lines || E'\n\n'
        || '4. หนึ่งการปรับที่ควรตกลงในทีม' || E'\n'
        || '- เลือกเจ้าภาพและกำหนดวันปิดงานให้รายการเร่งด่วน/เกินกำหนดทุกชิ้น'
    end
    || E'\n\nจุดตรวจสอบก่อนใช้' || E'\n'
    || '- ตรวจชื่อโครงการ สถานะ วันกำหนด และตัวเลขกับหลักฐานต้นทาง' || E'\n'
    || '- หากข้อมูลยังไม่อัปเดต ให้ระบุ [ต้องตรวจสอบ/เพิ่มเติม]' || E'\n'
    || '- รายงานนี้ไม่ใช่คำสั่งหรือการอนุมัติของผู้มีอำนาจ' || E'\n\n'
    || 'แหล่งข้อมูล: GovPrompt Work Tracking ณ เวลาที่สร้างรายงาน';

  return next;
end;
$function$;
