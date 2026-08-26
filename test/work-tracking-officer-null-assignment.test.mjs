import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260018_officer_null_assignment_guard.sql', import.meta.url), 'utf8');

test('OFFICER project authorization fails closed when owner is NULL', () => {
  assert.match(sql, /if coalesce\([\s\S]*v_project\.owner_user_id = v_user_id[\s\S]*false\s*\) = false then raise exception 'ROLE_FORBIDDEN'/i);
});

test('OFFICER task authorization fails closed when assignee is NULL', () => {
  assert.match(sql, /if coalesce\([\s\S]*v_task\.assigned_user_id = v_user_id[\s\S]*false\s*\) = false then raise exception 'ROLE_FORBIDDEN'/i);
});

test('patched mutation RPCs remain SECURITY DEFINER with fixed search path and authenticated-only grant intent', () => {
  assert.match(sql, /security definer/gi);
  assert.match(sql, /set search_path = public, pg_temp/gi);
  assert.match(sql, /revoke all on function public\.update_project_progress[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function public\.update_project_progress[\s\S]*to authenticated/i);
  assert.match(sql, /revoke all on function public\.update_task_state[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function public\.update_task_state[\s\S]*to authenticated/i);
});
