import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-operations-live-pilot.html', import.meta.url), 'utf8');
const inviteMigration = fs.readFileSync(new URL('../supabase/migrations/202608260010_pilot_invite_claim_flow.sql', import.meta.url), 'utf8');

test('live operations uses authenticated RPCs for project writes', () => {
  assert.match(html, /rpc\('create_project'/);
  assert.match(html, /rpc\('update_project_progress'/);
  assert.match(html, /p_expected_updated_at/);
  assert.match(html, /p_request_id/);
});

test('live operations never directly mutates project or audit tables', () => {
  assert.doesNotMatch(html, /from\('projects'\)\s*\.insert/);
  assert.doesNotMatch(html, /from\('projects'\)\s*\.update/);
  assert.doesNotMatch(html, /from\('projects'\)\s*\.delete/);
  assert.doesNotMatch(html, /from\('audit_events'\)\s*\.insert/);
  assert.doesNotMatch(html, /from\('audit_events'\)\s*\.update/);
  assert.doesNotMatch(html, /from\('audit_events'\)\s*\.delete/);
});

test('live operations reads projects and audit through RLS-protected selects', () => {
  assert.match(html, /from\('projects'\)\.select/);
  assert.match(html, /from\('audit_events'\)\.select/);
  assert.match(html, /resolveWorkSession/);
});

test('pilot invite claim is authenticated, identity-bound and unavailable to anon', () => {
  assert.match(inviteMigration, /auth\.uid\(\)/);
  assert.match(inviteMigration, /from auth\.users/);
  assert.match(inviteMigration, /where i\.email = v_email/);
  assert.match(inviteMigration, /revoke all on function public\.claim_work_pilot_invite\(\) from public, anon/);
  assert.match(inviteMigration, /grant execute on function public\.claim_work_pilot_invite\(\) to authenticated/);
});
