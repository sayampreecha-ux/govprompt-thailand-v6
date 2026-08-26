import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-tasks-live-pilot.html', import.meta.url), 'utf8');

test('live task page uses authenticated RLS reads and audited RPC writes', () => {
  assert.match(html, /getPilotSessionContext/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /supabase\.from\('projects'\)/);
  assert.match(html, /supabase\.from\('tasks'\)/);
  assert.match(html, /supabase\.rpc\('create_task'/);
  assert.match(html, /supabase\.rpc\('update_task_state'/);
});

test('live task page does not directly mutate business tables or persist browser state', () => {
  assert.doesNotMatch(html, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/i);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest/);
});

test('live task page includes no-op guard, safe DOM rendering, and production GP link', () => {
  assert.match(html, /ไม่มีข้อมูลเปลี่ยนแปลง/);
  assert.match(html, /textContent\s*=/);
  assert.doesNotMatch(html, /innerHTML\s*=/);
  assert.match(html, /href="\.\.\/">GP หลัก/);
  assert.match(html, /noindex,nofollow/);
});
