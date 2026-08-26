import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../supabase/migrations/202608260017_work_tracking_export_snapshot.sql', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../work-export-live-pilot.html', import.meta.url), 'utf8');

test('export RPC is authenticated, tenant-scoped, role-restricted and audited', () => {
  assert.match(migration, /create or replace function public\.export_work_tracking_snapshot/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /organization_id = p_organization_id[\s\S]*user_id = v_user_id[\s\S]*active = true/);
  assert.match(migration, /v_membership\.role not in \('ORG_ADMIN', 'AUDITOR'\)/);
  assert.match(migration, /'EXPORT_CREATED'/);
  assert.match(migration, /'WORK_TRACKING_EXPORT_RPC'/);
  assert.match(migration, /revoke all on function public\.export_work_tracking_snapshot\(uuid,text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.export_work_tracking_snapshot\(uuid,text\) to authenticated/);
});

test('export snapshot includes operational records but excludes auth directory and invitation email data', () => {
  assert.match(migration, /'departments'/);
  assert.match(migration, /'projects'/);
  assert.match(migration, /'tasks'/);
  assert.match(migration, /'importBatches'/);
  assert.match(migration, /'auditEvents'/);
  assert.doesNotMatch(migration, /from\s+auth\.users/i);
  assert.doesNotMatch(migration, /from\s+public\.pilot_invites/i);
  assert.doesNotMatch(migration, /'email'/i);
});

test('export page calls only the audited RPC and requires explicit handling confirmations', () => {
  assert.match(html, /getPilotSessionContext/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /\['ORG_ADMIN','AUDITOR'\]/);
  assert.match(html, /id="confirmScope"/);
  assert.match(html, /id="confirmHandling"/);
  assert.match(html, /supabase\.rpc\('export_work_tracking_snapshot'/);
  assert.doesNotMatch(html, /supabase\.from\(/);
  assert.doesNotMatch(html, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/i);
});

test('export page creates a browser download without persistent browser storage or unsafe HTML rendering', () => {
  assert.match(html, /new Blob\(/);
  assert.match(html, /URL\.createObjectURL/);
  assert.match(html, /URL\.revokeObjectURL/);
  assert.match(html, /gp-work-tracking-export-/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /innerHTML/);
  assert.match(html, /href="\.\.\/">GP หลัก/);
  assert.match(html, /noindex,nofollow/);
});
