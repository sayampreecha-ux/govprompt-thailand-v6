import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync('supabase/migrations/20260826135447_organization_automation_pilot.sql', 'utf8');

test('automation tables enforce RLS and least-privilege grants', () => {
  assert.match(sql, /alter table public\.automation_definitions enable row level security/i);
  assert.match(sql, /alter table public\.automation_runs enable row level security/i);
  assert.match(sql, /revoke all on table public\.automation_definitions from anon, authenticated/i);
  assert.match(sql, /grant select on table public\.automation_definitions to authenticated/i);
  assert.match(sql, /automation_definitions_select_scope/);
  assert.match(sql, /automation_runs_select_scope/);
});

test('human approval cannot be disabled and every run waits for review', () => {
  assert.match(sql, /requires_human_approval = true/);
  assert.match(sql, /default 'WAITING_APPROVAL'/);
  assert.match(sql, /RUN_ALREADY_REVIEWED/);
  assert.match(sql, /p_decision not in \('APPROVE','REJECT'\)/);
});

test('scheduler is bounded to internal reports and cannot send externally', () => {
  assert.match(sql, /govprompt-automation-pilot/);
  assert.match(sql, /private\.process_due_automations/);
  assert.doesNotMatch(sql, /net\.http|smtp|gmail|webhook/i);
  assert.deepEqual([...sql.matchAll(/'PROJECT_DAILY_BRIEF'|'DEADLINE_WATCH'|'TASK_WEEKLY_SUMMARY'/g)].length > 0, true);
});
