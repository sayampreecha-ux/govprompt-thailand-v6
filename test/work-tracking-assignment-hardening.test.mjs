import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260006_assignment_hardening.sql', import.meta.url), 'utf8');

test('project assignment is limited to admin or same-department director', () => {
  const block = sql.match(/create or replace function public\.assign_project[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /role = 'ORG_ADMIN'/i);
  assert.match(block, /role = 'DIRECTOR'[\s\S]+department_id = v_project\.department_id/i);
  assert.doesNotMatch(block, /v_membership\.role = 'OFFICER'/i);
});

test('project owner target is active same-department director or officer only', () => {
  const block = sql.match(/create or replace function public\.assign_project[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /department_id = v_project\.department_id[\s\S]+role in \('DIRECTOR','OFFICER'\)/i);
  assert.doesNotMatch(block, /role in \('ORG_ADMIN','EXECUTIVE'\)/i);
});

test('task assignee target excludes executive and organization admin roles', () => {
  const block = sql.match(/create or replace function public\.assign_task[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /department_id = v_task\.department_id[\s\S]+role in \('DIRECTOR','OFFICER'\)/i);
  assert.doesNotMatch(block, /role in \('ORG_ADMIN','EXECUTIVE'\)/i);
});

test('assignment RPCs use optimistic concurrency and audit writes', () => {
  assert.match(sql, /assign_project[\s\S]+CONFLICT_VERSION[\s\S]+PROJECT_ASSIGNED/i);
  assert.match(sql, /assign_task[\s\S]+CONFLICT_VERSION[\s\S]+TASK_ASSIGNED/i);
  assert.match(sql, /revoke all on function public\.assign_project[\s\S]+from public, anon;/i);
});
