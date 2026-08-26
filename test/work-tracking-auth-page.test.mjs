import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-login-pilot.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/work-tracking/supabase-browser.mjs', import.meta.url), 'utf8');

test('pilot auth page uses Supabase Auth and membership resolver', () => {
  assert.match(html, /signInWithPassword/);
  assert.match(html, /auth\.signUp/);
  assert.match(html, /resolveWorkSession/);
  assert.match(client, /organization_memberships/);
});

test('browser client contains only publishable credential class, never server secret', () => {
  assert.match(client, /sb_publishable_/);
  assert.doesNotMatch(client, /service_role/i);
  assert.doesNotMatch(client, /sb_secret_/i);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE/i);
});

test('membership is required before organization links are shown', () => {
  assert.match(html, /ยังไม่มีสิทธิองค์กร/);
  assert.match(html, /links\.classList\.remove\('hidden'\)/);
  assert.match(html, /links\.classList\.add\('hidden'\)/);
});
