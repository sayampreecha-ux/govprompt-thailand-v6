import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/functions/work-pilot/index.ts', import.meta.url), 'utf8');

test('work-pilot edge function explicitly returns UTF-8 HTML', () => {
  assert.match(source, /Content-Type', 'text\/html; charset=UTF-8'/);
  assert.match(source, /new TextEncoder\(\)\.encode\(html\)/);
  assert.match(source, /X-Content-Type-Options', 'nosniff'/);
  assert.match(source, /Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'/);
});

test('work-pilot page does not embed a personal email or server secret', () => {
  assert.doesNotMatch(source, /value=["'][^"']+@[^"']+["']/i);
  assert.doesNotMatch(source, /service_role/i);
  assert.doesNotMatch(source, /sb_secret_/i);
});

test('work-pilot remains an internal no-index pilot page', () => {
  assert.match(source, /noindex,nofollow/);
  assert.match(source, /claim_work_pilot_invite/);
});
