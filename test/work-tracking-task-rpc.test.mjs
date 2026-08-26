import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260003_task_rpc.sql', import.meta.url), 'utf8');

test('task update RPC resolves auth identity and enforces assigned officer scope', () => {
  assert.match(sql, /update_task_state[\s\S]+auth\.uid\(\)/i);
  assert.match(sql, /v_membership\.role = 'OFFICER'[\s\S]+v_task\.assigned_user_id = v_user_id/i);
  assert.doesNotMatch(sql.match(/create or replace function public\.update_task_state[\s\S]*?\$\$;/i)?.[0] || '', /EXECUTIVE|AUDITOR/);
});

test('task update RPC uses optimistic concurrency and atomic audit', () => {
  const block = sql.match(/create or replace function public\.update_task_state[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /CONFLICT_VERSION/);
  assert.match(block, /update public\.tasks[\s\S]+insert into public\.audit_events/i);
});

test('historical task assignment RPC is authenticated, membership-scoped and audited', () => {
  const block = sql.match(/create or replace function public\.assign_task[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /auth\.uid\(\)/i);
  assert.match(block, /organization_id = v_task\.organization_id[\s\S]+user_id = v_user_id[\s\S]+active = true/i);
  assert.match(block, /CONFLICT_VERSION/i);
  assert.match(block, /update public\.tasks[\s\S]+insert into public\.audit_events/i);
  assert.match(block, /TASK_ASSIGNED/i);
  // Final assignment-role policy is intentionally guarded by migration 006 tests.
});

test('task RPCs revoke public and anon execution', () => {
  assert.match(sql, /revoke all on function public\.update_task_state[\s\S]+from public, anon;/i);
  assert.match(sql, /revoke all on function public\.assign_task[\s\S]+from public, anon;/i);
});
