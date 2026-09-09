import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260019_scope_integrity_constraints.sql', import.meta.url), 'utf8');

test('department-scoped roles must have a department and org-wide roles must not', () => {
  assert.match(sql, /role in \('ORG_ADMIN','EXECUTIVE','AUDITOR'\) and department_id is null/i);
  assert.match(sql, /role in \('DIRECTOR','OFFICER'\) and department_id is not null/i);
});

test('organization + department composite foreign keys protect tenant scope', () => {
  for (const table of ['organization_memberships','projects','tasks','import_batches','audit_events','pilot_invites']) {
    assert.match(sql, new RegExp(`alter table public\\.${table}[\\s\\S]*foreign key \\(organization_id, department_id\\)[\\s\\S]*references public\\.departments\\(organization_id, id\\)`, 'i'));
  }
});
