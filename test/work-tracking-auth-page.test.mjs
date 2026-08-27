import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-login-pilot.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/work-tracking/supabase-browser.mjs', import.meta.url), 'utf8');

test('pilot auth page uses password as primary while magic link redirect is not configured', () => {
  assert.match(html, /signInPilotWithPassword/);
  assert.match(html, /<h2>เข้าสู่ระบบด้วยรหัสผ่าน<\/h2>/);
  assert.match(html, /Magic Link \(พักใช้งานชั่วคราว\)/);
  assert.match(html, /id="magicBtn"[^>]*disabled/);
  assert.match(html, /localhost/);
  assert.match(html, /PILOT_REDIRECT_URL='https:\/\/sayampreecha-ux\.github\.io\/govprompt-thailand-v6\/pilot\/'/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /claim_work_pilot_invite/);
  assert.match(client, /organization_memberships/);
  assert.doesNotMatch(html, /auth\.signUp/);
});

test('password primary flow does not send email or create a new account', () => {
  assert.match(html, /type="password"/);
  assert.match(html, /signInPilotWithPassword\(\{client:supabase,email,password\}\)/);
  assert.doesNotMatch(html, /requestPilotMagicLink/);
  assert.doesNotMatch(html, /signInWithOtp/);
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

test('pilot login safely renders session context and links Workspace back to production GP', () => {
  assert.match(html, /box\.replaceChildren\(\)/);
  assert.match(html, /textContent=/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
  assert.match(html, /Workspace องค์กร/);
  assert.match(html, /href="https:\/\/sayampreecha-ux\.github\.io\/-ai-local-government-assistant\/">GP หลัก/);
  assert.match(html, /href="https:\/\/sayampreecha-ux\.github\.io\/-ai-local-government-assistant\/automation-pilot\.html">งานอัตโนมัติ/);
  assert.match(html, /noindex,nofollow/);
});

test('workspace clearly separates live CSV commit, local-only preview and audited export', () => {
  assert.match(html, /href="work-import-live-pilot\.html">นำเข้า CSV จริง/);
  assert.match(html, /href="work-tracking-import-preview\.html">Preview CSV local-only/);
  assert.match(html, /href="work-export-live-pilot\.html">ส่งออก Snapshot/);
});
