import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/functions/work-change-password/index.ts', import.meta.url), 'utf8');

test('first-login password change is authenticated and server-side only', () => {
  assert.match(source, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(source, /admin\.auth\.getUser\(token\)/);
  assert.match(source, /caller\.app_metadata\?\.must_change_password !== true/);
  assert.match(source, /admin\.auth\.admin\.updateUserById\(caller\.id/);
  assert.doesNotMatch(source, /sb_secret_|service_role\s*[:=]\s*["'][A-Za-z0-9._-]+/i);
});

test('password change clears the forced-change flag and writes an audit event', () => {
  assert.match(source, /must_change_password:\s*false/);
  assert.match(source, /initial_password_changed_at/);
  assert.match(source, /INITIAL_PASSWORD_CHANGED/);
  assert.match(source, /first_login_password_rotation/);
});

test('new password is never copied into audit metadata or returned', () => {
  const auditBlock = source.match(/const auditRows[\s\S]*?admin\.from\("audit_events"\)/)?.[0] || '';
  assert.doesNotMatch(auditBlock, /newPassword/);
  assert.match(source, /return reply\(req, 200, \{ ok: true, changed: true \}\)/);
});
