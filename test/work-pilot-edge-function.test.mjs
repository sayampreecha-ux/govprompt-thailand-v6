import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/functions/work-pilot/index.ts', import.meta.url), 'utf8');
const legacyLogin = fs.readFileSync(new URL('../work-pilot-login.html', import.meta.url), 'utf8');

test('legacy work-pilot redirects to the single Workspace entry', () => {
  assert.match(source, /WORKSPACE_URL/);
  assert.match(source, /govprompt-thailand-v6\/pilot\//);
  assert.match(source, /status:\s*302/);
  assert.match(source, /Location:\s*WORKSPACE_URL/);
  assert.match(source, /noindex, nofollow/);
  assert.match(source, /X-Content-Type-Options/);
  assert.match(source, /Cache-Control/);
});

test('legacy work-pilot no longer exposes email signup or invite claim', () => {
  assert.doesNotMatch(source, /signup|signInWithOtp|claim_work_pilot_invite/i);
  assert.doesNotMatch(source, /service_role|sb_secret_/i);
});

test('legacy static login bookmark redirects to username-password Workspace', () => {
  assert.match(legacyLogin, /url=work-login-pilot\.html/);
  assert.match(legacyLogin, /location\.replace\('work-login-pilot\.html'\)/);
  assert.match(legacyLogin, /Workspace องค์กร/);
  assert.doesNotMatch(legacyLogin, /Magic Link|type="email"|signup|claim_work_pilot_invite/i);
  assert.match(legacyLogin, /noindex,nofollow/);
});
