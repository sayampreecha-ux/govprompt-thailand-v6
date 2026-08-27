import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-members-live-pilot.html', import.meta.url), 'utf8');

test('member workspace uses authenticated RLS reads and controlled server actions', () => {
  assert.match(html, /getPilotSessionContext/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /supabase\.from\('organization_memberships'\)/);
  assert.match(html, /supabase\.from\('departments'\)/);
  assert.match(html, /supabase\.rpc\('set_my_work_display_name'/);
  assert.match(html, /supabase\.functions\.invoke\('work-admin-users'/);
  assert.match(html, /supabase\.rpc\('list_assignable_work_members'/);
});

test('admin-created account UI does not ask for email or expose signup', () => {
  assert.match(html, /ชื่อผู้ใช้ \+ รหัสผ่าน/);
  assert.match(html, /id="accountUsername"/);
  assert.match(html, /id="accountPassword"/);
  assert.match(html, /id="createAccountBtn"/);
  assert.doesNotMatch(html, /id="inviteEmail"|type="email"|สร้างคำเชิญ|Magic Link/i);
  assert.doesNotMatch(html, /<option\s+value="ORG_ADMIN"/i);
});

test('account creation is restricted in UI to ORG_ADMIN and keeps secrets out of browser code', () => {
  assert.match(html, /actor\.role!=='ORG_ADMIN'/);
  assert.match(html, /work-admin-users/);
  assert.doesNotMatch(html, /service_role|sb_secret_/i);
  assert.doesNotMatch(html, /auth\.users/i);
  assert.doesNotMatch(html, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/i);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest/);
});

test('member directory remains privacy-minimal and safe DOM rendered', () => {
  assert.match(html, /โดยไม่เปิดข้อมูลล็อกอิน/);
  assert.match(html, /textContent\s*=/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
  assert.match(html, /noindex,nofollow/);
  assert.match(html, /href="https:\/\/sayampreecha-ux\.github\.io\/-ai-local-government-assistant\/">GP หลัก/);
});
