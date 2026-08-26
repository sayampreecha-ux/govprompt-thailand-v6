import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-command-center-pilot.html', import.meta.url), 'utf8');

test('command center page uses deterministic command center core', () => {
  assert.match(html, /buildCommandCenter/);
  assert.match(html, /Action Queue/);
  assert.match(html, /โครงการเร่งด่วน/);
  assert.match(html, /งานย่อยเร่งด่วน/);
});

test('command center page reads live RLS data without direct writes or browser persistence', () => {
  assert.match(html, /getPilotSessionContext/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /supabase\.from\('projects'\)/);
  assert.match(html, /supabase\.from\('tasks'\)/);

  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /supabase\.rpc\s*\(/i);
  assert.doesNotMatch(html, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/i);
});
