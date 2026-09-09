import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-tracking-import-preview.html', import.meta.url), 'utf8');

test('import preview page wires row-level quality module and source-row UX', () => {
  assert.match(html, /buildProjectImportPreview/);
  assert.match(html, /แถว CSV/);
  assert.match(html, /ERROR = ห้าม commit/);
  assert.match(html, /WARNING = ต้องยืนยัน/);
});

test('import preview page remains local-only with no persistence or network primitive', () => {
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /supabase\.(from|rpc)|createClient/i);
});
