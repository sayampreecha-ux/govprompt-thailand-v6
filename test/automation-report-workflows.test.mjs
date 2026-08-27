import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  'supabase/migrations/20260827000243_automation_report_workflows.sql',
  'utf8'
);

test('automation report v2 keeps the report builder private and scope-aware', () => {
  assert.match(sql, /function private\.build_automation_report/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /'reportVersion', 2/);
  assert.match(sql, /'organizationId', v_definition\.organization_id/);
  assert.match(sql, /'departmentId', v_definition\.department_id/);
  assert.match(sql, /'workflowType', v_definition\.workflow_type/);
});

test('each production pilot workflow has a distinct decision surface', () => {
  assert.match(sql, /when 'PROJECT_DAILY_BRIEF' then[\s\S]*1\. ภาพรวมวันนี้/);
  assert.match(sql, /when 'DEADLINE_WATCH' then[\s\S]*Checklist โครงการ/);
  assert.match(sql, /Key Insights ประจำสัปดาห์/);
  assert.match(sql, /โครงการครบกำหนดภายใน 7 วัน/);
  assert.match(sql, /งานย่อยครบกำหนดภายใน 3 วัน/);
  assert.match(sql, /หนึ่งการปรับที่ควรตกลงในทีม/);
});

test('report generation remains read-only and preserves human review language', () => {
  assert.doesNotMatch(sql, /\b(update|delete from)\s+public\.(projects|tasks)\b/i);
  assert.doesNotMatch(sql, /\binsert into\s+public\.(projects|tasks)\b/i);
  assert.match(sql, /ฉบับรอตรวจสอบโดยเจ้าหน้าที่/);
  assert.match(sql, /ไม่ใช่คำสั่งหรือการอนุมัติของผู้มีอำนาจ/);
  assert.match(sql, /ต้องตรวจสอบ\/เพิ่มเติม/);
});
