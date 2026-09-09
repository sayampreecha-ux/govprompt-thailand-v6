import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260007_import_commit_rpc.sql', import.meta.url), 'utf8');
const fn = sql.match(/create or replace function public\.commit_project_import[\s\S]*?\$\$;/i)?.[0] || '';

test('import commit rechecks active organization membership and restricts commit roles', () => {
  assert.match(fn, /organization_id = p_organization_id[\s\S]+user_id = v_user_id[\s\S]+active = true/i);
  assert.match(fn, /role = 'ORG_ADMIN'/i);
  assert.match(fn, /role = 'DIRECTOR'[\s\S]+department_id = p_department_id/i);
  assert.doesNotMatch(fn, /v_membership\.role = 'OFFICER'/i);
});

test('server import validates required fields, progress, dates and status before persistence', () => {
  assert.match(fn, /PROJECT_CODE_REQUIRED/i);
  assert.match(fn, /PROJECT_NAME_REQUIRED/i);
  assert.match(fn, /PROGRESS_OUT_OF_RANGE/i);
  assert.match(fn, /INVALID_DATE_ORDER/i);
  assert.match(fn, /INVALID_STATUS/i);
  assert.match(fn, /COMPLETED_PROGRESS_MISMATCH/i);
});

test('warnings require explicit confirmation and duplicate/existing codes abort', () => {
  assert.match(fn, /v_spent > v_budget[\s\S]+v_warning_count := v_warning_count \+ 1/i);
  assert.match(fn, /WARNING_CONFIRMATION_REQUIRED/i);
  assert.match(fn, /DUPLICATE_PROJECT_CODE/i);
  assert.match(fn, /PROJECT_CODE_EXISTS/i);
});

test('import writes batch, projects and audit records within one function transaction', () => {
  assert.match(fn, /insert into public\.import_batches[\s\S]+insert into public\.projects[\s\S]+insert into public\.audit_events/i);
  assert.match(fn, /IMPORT_COMMITTED/i);
  assert.doesNotMatch(fn, /raw_csv|csv_text|file_content/i);
});

test('import execution is unavailable to public and anon', () => {
  assert.match(sql, /revoke all on function public\.commit_project_import[\s\S]+from public, anon;/i);
  assert.match(sql, /grant execute on function public\.commit_project_import[\s\S]+to authenticated;/i);
});
