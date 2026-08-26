import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../work-import-live-pilot.html', import.meta.url), 'utf8');

test('live import requires authenticated organization context and explicit human confirmation', () => {
  assert.match(html, /getPilotSessionContext/);
  assert.match(html, /resolveWorkSession/);
  assert.match(html, /\['ORG_ADMIN','DIRECTOR'\]/);
  assert.match(html, /id="confirmCommit"/);
  assert.match(html, /id="confirmWarnings"/);
  assert.match(html, /commitAllowed\(\)/);
});

test('live import previews locally then commits only through audited import RPC', () => {
  assert.match(html, /selectedFile\.text\(\)/);
  assert.match(html, /buildProjectImportPreview\(text,actor\.organizationId\)/);
  assert.match(html, /buildCommitProjectImportRpc/);
  assert.match(html, /supabase\.rpc\('commit_project_import',args\)/);
  assert.doesNotMatch(html, /\.from\(['"]projects['"]\)\.(insert|update|delete|upsert)/);
  assert.doesNotMatch(html, /\.from\(['"]import_batches['"]\)\.(insert|update|delete|upsert)/);
  assert.doesNotMatch(html, /\.from\(['"]audit_events['"]\)\.(insert|update|delete|upsert)/);
});

test('live import does not persist raw CSV or use unsafe HTML rendering', () => {
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /innerHTML/);
  assert.doesNotMatch(html, /p_csv|csvText\s*:/);
  assert.match(html, /ไฟล์ CSV ดิบไม่ถูกอัปโหลดหรือเก็บถาวร/);
});

test('live import enforces pilot batch and file-size limits before commit', () => {
  assert.match(html, /MAX_ROWS = 500/);
  assert.match(html, /MAX_FILE_BYTES = 2 \* 1024 \* 1024/);
  assert.match(html, /preview\.summary\.totalRows > MAX_ROWS/);
  assert.match(html, /selectedFile\.size > MAX_FILE_BYTES/);
});
