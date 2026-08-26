import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260002_project_progress_rpc.sql', import.meta.url), 'utf8');

test('RPC derives caller identity from auth context and checks membership', () => {
  assert.match(sql, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(sql, /organization_memberships[\s\S]+organization_id = v_project\.organization_id[\s\S]+user_id = v_user_id/i);
});

test('RPC allows only admin, same-department director, or assigned officer', () => {
  assert.match(sql, /v_membership\.role = 'ORG_ADMIN'/i);
  assert.match(sql, /v_membership\.role = 'DIRECTOR'[\s\S]+department_id = v_project\.department_id/i);
  assert.match(sql, /v_membership\.role = 'OFFICER'[\s\S]+v_project\.owner_user_id = v_user_id/i);
  assert.doesNotMatch(sql, /v_membership\.role = 'EXECUTIVE'/i);
  assert.doesNotMatch(sql, /v_membership\.role = 'AUDITOR'/i);
});

test('RPC uses optimistic concurrency and writes audit in the same function', () => {
  assert.match(sql, /p_expected_updated_at[\s\S]+v_project\.updated_at <> p_expected_updated_at[\s\S]+CONFLICT_VERSION/i);
  assert.match(sql, /update public\.projects[\s\S]+insert into public\.audit_events/i);
});

test('RPC is not executable by public or anon', () => {
  assert.match(sql, /revoke all on function public\.update_project_progress[\s\S]+from public, anon;/i);
  assert.match(sql, /grant execute on function public\.update_project_progress[\s\S]+to authenticated;/i);
});
