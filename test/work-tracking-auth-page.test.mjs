import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-login-pilot.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/work-tracking/supabase-browser.mjs', import.meta.url), 'utf8');

test('pilot auth page uses magic link primary flow, password fallback and membership resolver', () => {
  assert.match(html, /requestPilotMagicLink/);
  assert.match(html, /signInPilotWithPassword/);
  assert.match(html, /เข้าสู่ระบบด้วยรหัสผ่าน \(สำรอง\)/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /claim_work_pilot_invite/);
  assert.match(client, /organization_memberships/);
  assert.doesNotMatch(html, /auth\.signUp/);
});

test('password fallback opens when magic-link request is rate limited', () => {
  assert.match(html, /passwordFallback/);
  assert.match(html, /described\.retryAfterSeconds>0\)\{\$\('passwordFallback'\)\.open=true/);
  assert.match(html, /type="password"/);
});

test('browser client contains only publishable credential class, never server secret', () => {
  assert.match(client, /sb_publishable_/);
  assert.doesNotMatch(client, /service_role/i);
  assert.doesNotMatch(client, /sb_secret_/i);
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE/i);
});

test('membership is required before organization links are shown', () => {
  assert.match(html, /ยังไม่มีสิทธิองค์กร/);
  assert.match(html, /classList\.toggle\('hidden',!resolved\.ok\)/);
  assert.match(html, /resolveWorkSession/);
});

test('pilot login safely renders session context and links back to production GP root', () => {
  assert.match(html, /box\.replaceChildren\(\)/);
  assert.match(html, /textContent=/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
  assert.match(html, /href="\.\.\/">GP หลัก/);
  assert.match(html, /noindex,nofollow/);
});

test('workspace clearly separates live CSV commit, local-only preview and audited export', () => {
  assert.match(html, /href="work-import-live-pilot\.html">นำเข้า CSV จริง/);
  assert.match(html, /href="work-tracking-import-preview\.html">Preview CSV local-only/);
  assert.match(html, /href="work-export-live-pilot\.html">ส่งออก Snapshot/);
});
