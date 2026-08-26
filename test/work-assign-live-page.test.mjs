import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-assign-live-pilot.html', import.meta.url), 'utf8');

test('assignment workspace uses minimal directory and audited assignment RPCs', () => {
  assert.match(html, /list_assignable_work_members/);
  assert.match(html, /supabase\.rpc\('assign_project'/);
  assert.match(html, /supabase\.rpc\('assign_task'/);
  assert.match(html, /ORG_ADMIN','DIRECTOR/);
});

test('assignment workspace reads scoped work without direct browser mutation', () => {
  assert.match(html, /supabase\.from\('projects'\)/);
  assert.match(html, /supabase\.from\('tasks'\)/);
  assert.doesNotMatch(html, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/i);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest/);
});

test('assignment workspace avoids email directory and unsafe HTML rendering', () => {
  assert.match(html, /ไม่ต้องอ่านรายชื่ออีเมลจาก Auth/);
  assert.doesNotMatch(html, /auth\.users/i);
  assert.match(html, /textContent\s*=/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
  assert.match(html, /noindex,nofollow/);
});

test('assignment UI skips duplicate assignment before calling RPC', () => {
  assert.match(html, /ถูกมอบหมายอยู่แล้ว จึงไม่บันทึกซ้ำ/);
});
