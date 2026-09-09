import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260005_create_rpcs.sql', import.meta.url), 'utf8');

test('create project verifies requested organization membership', () => {
  const block = sql.match(/create or replace function public\.create_project[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /organization_id = p_organization_id[\s\S]+user_id = v_user_id/i);
  assert.match(block, /TENANT_MISMATCH/i);
});

test('officer project creation is limited to same department and self ownership', () => {
  const block = sql.match(/create or replace function public\.create_project[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /role = 'OFFICER'[\s\S]+department_id = p_department_id/i);
  assert.match(block, /v_owner_id <> v_user_id[\s\S]+OWNER_NOT_ALLOWED/i);
});

test('task creation derives tenant and department from existing project', () => {
  const block = sql.match(/create or replace function public\.create_task[\s\S]*?\$\$;/i)?.[0] || '';
  assert.match(block, /select \* into v_project from public\.projects where id = p_project_id/i);
  assert.match(block, /v_project\.organization_id/);
  assert.match(block, /v_project\.department_id/);
});

test('create RPCs write audit events and are unavailable to public and anon', () => {
  assert.match(sql, /insert into public\.audit_events/g);
  assert.match(sql, /revoke all on function public\.create_project[\s\S]+from public, anon;/i);
  assert.match(sql, /revoke all on function public\.create_task[\s\S]+from public, anon;/i);
});
