import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../work-uat-pilot.html', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/202608260020_pilot_uat_results.sql', import.meta.url), 'utf8');

test('UAT page writes and reads through reviewed RPCs only', () => {
  assert.match(page, /submit_work_pilot_uat/);
  assert.match(page, /get_my_work_pilot_uat/);
  assert.match(page, /get_work_pilot_uat_summary/);
  assert.doesNotMatch(page, /\.from\(['"]pilot_uat_results['"]\)/);
  assert.doesNotMatch(page, /innerHTML\s*=/);
});

test('UAT page covers all five pilot roles and role-boundary verification', () => {
  for (const role of ['ORG_ADMIN','EXECUTIVE','DIRECTOR','OFFICER','AUDITOR']) assert.match(page, new RegExp(role));
  assert.match(page, /ROLE_BOUNDARY/);
  assert.match(page, /PASS/);
  assert.match(page, /FAIL/);
  assert.match(page, /BLOCKED/);
});

test('UAT persistence is RLS-enabled, direct table access revoked, and notes are not copied into audit metadata', () => {
  assert.match(migration, /alter table public\.pilot_uat_results enable row level security/i);
  assert.match(migration, /revoke all on public\.pilot_uat_results from public, anon, authenticated/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /grant execute on function public\.submit_work_pilot_uat/i);
  const auditBuild = migration.match(/jsonb_build_object\('testKey'[\s\S]*?'WORK_TRACKING_UAT_RPC'\)/i)?.[0] || '';
  assert.ok(auditBuild);
  assert.doesNotMatch(auditBuild, /notes/i);
});
