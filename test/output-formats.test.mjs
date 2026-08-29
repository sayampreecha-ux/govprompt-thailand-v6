import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('output-formats.js', 'utf8');

function api() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_OUTPUT_FORMATS;
}

test('registers the ten requested output formats without adding GP tools', () => {
  const formats = api().formats;
  assert.equal(formats.length, 10);
  assert.deepEqual([...formats].map(item => item.id), [
    'easy-summary', 'step-by-step', 'timeline', 'comparison', 'workflow',
    'checklist', 'do-dont', 'framework', 'key-insights', 'quick-guide'
  ]);
});

test('builds a safe government infographic prompt block', () => {
  const block = api().buildPromptBlock('timeline');
  assert.match(block, /Timeline/);
  assert.match(block, /ข้อเท็จจริง/);
  assert.match(block, /งานกฎหมาย\/พัสดุ/);
  assert.match(block, /ข้อมูลส่วนบุคคล/);
  assert.match(block, /\[ต้องตรวจสอบ\/เพิ่มเติม\]/);
});

test('uses deterministic defaults and tool suggestions', () => {
  const formats = api();
  assert.equal(formats.resolve('missing').id, 'easy-summary');
  assert.equal(formats.suggestForTool({ id: 'GP009', category: 'พัสดุ' }), 'checklist');
  assert.equal(formats.suggestForTool({ id: 'GP004', category: 'หนังสือราชการ' }), 'timeline');
  assert.equal(formats.suggestForTool({ id: 'GP019', category: 'ผู้บริหาร' }), 'key-insights');
});

test('is immutable and has no persistence or network primitives', () => {
  const formats = api();
  assert.equal(Object.isFrozen(formats), true);
  assert.equal(Object.isFrozen(formats.formats), true);
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
