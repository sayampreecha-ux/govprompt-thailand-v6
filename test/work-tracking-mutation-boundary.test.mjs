import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/202608260004_harden_direct_mutations.sql', import.meta.url), 'utf8');

test('authenticated browser cannot directly mutate projects or tasks', () => {
  assert.match(sql, /revoke insert, update, delete on public\.projects from authenticated;/i);
  assert.match(sql, /revoke insert, update, delete on public\.tasks from authenticated;/i);
});

test('read access remains available for RLS-protected dashboards', () => {
  assert.match(sql, /grant select on public\.projects, public\.tasks to authenticated;/i);
});
