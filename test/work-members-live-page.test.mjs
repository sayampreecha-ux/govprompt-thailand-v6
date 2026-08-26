import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-members-live-pilot.html', import.meta.url), 'utf8');

test('member workspace uses authenticated RLS reads and controlled RPCs', () => {
  assert.match(html, /getPilotSessionContext/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /supabase\.from\('organization_memberships'\)/);
  assert.match(html, /supabase\.from\('departments'\)/);
  assert.match(html, /supabase\.rpc\('set_my_work_display_name'/);
  assert.match(html, /supabase\.rpc\('create_work_pilot_invite'/);
  assert.match(html, /supabase\.rpc\('list_assignable_work_members'/);
});

test('member workspace does not query auth.users or directly mutate business tables', () => {
  assert.doesNotMatch(html, /auth\.users/i);
  assert.doesNotMatch(html, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/i);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest/);
});

test('member directory is privacy-minimal and safe DOM rendered', () => {
  assert.match(html, /Directory นี้ตั้งใจไม่คืนอีเมล/);
  assert.match(html, /textContent\s*=/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
  assert.match(html, /noindex,nofollow/);
  assert.match(html, /href="\.\.\/">GP หลัก/);
});

test('invite UI is explicitly restricted and explains manual pilot-link delivery', () => {
  assert.match(html, /actor\.role!=='ORG_ADMIN'/);
  assert.match(html, /ระบบ Pilot ยังไม่ส่งอีเมลอัตโนมัติ/);
  assert.doesNotMatch(html, /ORG_ADMIN ·/);
});
