import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260001_work_tracking_pilot.sql', import.meta.url), 'utf8');

const protectedTables = [
  'organizations', 'departments', 'organization_memberships', 'projects',
  'tasks', 'import_batches', 'audit_events',
];

test('enables RLS for every pilot business table', () => {
  for (const table of protectedTables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
});

test('revokes default anon and authenticated privileges before granting minimum access', () => {
  assert.match(sql, /revoke all on[\s\S]+from anon, authenticated;/i);
  assert.doesNotMatch(sql, /grant\s+all[\s\S]+to\s+anon/i);
});

test('project and task policies include organization membership checks', () => {
  assert.match(sql, /projects_select_scope[\s\S]+m\.organization_id = projects\.organization_id[\s\S]+m\.user_id = auth\.uid\(\)/i);
  assert.match(sql, /tasks_select_scope[\s\S]+m\.organization_id = tasks\.organization_id[\s\S]+m\.user_id = auth\.uid\(\)/i);
});

test('executive and auditor have no project update policy path', () => {
  const updatePolicy = sql.match(/create policy projects_update_scope[\s\S]*?create policy projects_delete_admin/i)?.[0] || '';
  assert.doesNotMatch(updatePolicy, /EXECUTIVE/);
  assert.doesNotMatch(updatePolicy, /AUDITOR/);
});

test('audit and import tables are not granted direct client mutation privileges', () => {
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[^;]*audit_events[^;]*to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[^;]*import_batches[^;]*to authenticated/i);
});
