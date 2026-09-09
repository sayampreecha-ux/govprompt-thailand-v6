import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('shared-context.js', 'utf8');

function contextApi() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_CONTEXT;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('starts with the documented immutable state', () => {
  const snapshot = contextApi().get();
  assert.deepEqual(plain(snapshot), {
    version: 1, query: '', selectedGpId: null, category: null, userInputs: {},
    routing: { score: 0, confidence: 0, matchedReason: '', fallback: true },
    evidence: { provided: false, types: [], count: 0 }, riskFlags: [], workflowState: 'idle'
  });
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.routing), true);
  assert.throws(() => { snapshot.userInputs.example = 'value'; }, TypeError);
});

test('records routing metadata without changing the routing result', () => {
  const api = contextApi();
  const routeResult = { selectedGpId: 'GP009', score: 0.42, confidence: 0.42, matchedReason: 'matched GP009', fallback: false };
  api.setRouting(routeResult, 'ตรวจร่าง TOR');
  const snapshot = api.get();
  assert.equal(snapshot.query, 'ตรวจร่าง TOR');
  assert.deepEqual(plain(snapshot.routing), { score: 0.42, confidence: 0.42, matchedReason: 'matched GP009', fallback: false });
  assert.deepEqual(routeResult, { selectedGpId: 'GP009', score: 0.42, confidence: 0.42, matchedReason: 'matched GP009', fallback: false });
});

test('records selected GP, category, and transient form values', () => {
  const api = contextApi();
  api.selectTool({ id: 'GP009', category: 'พัสดุ' });
  api.setUserInputs({ รายการพัสดุ: 'ตัวอย่าง', วงเงิน: '1000' });
  const snapshot = api.get();
  assert.equal(snapshot.selectedGpId, 'GP009');
  assert.equal(snapshot.category, 'พัสดุ');
  assert.deepEqual(plain(snapshot.userInputs), { รายการพัสดุ: 'ตัวอย่าง', วงเงิน: '1000' });
  assert.equal(snapshot.workflowState, 'collecting-input');
});

test('clears transient data and can reset the whole context', () => {
  const api = contextApi();
  api.selectTool({ id: 'GP016', category: 'ประชาสัมพันธ์' });
  api.setUserInputs({ หัวเรื่อง: 'ประกาศตัวอย่าง' });
  api.clearUserInputs();
  assert.deepEqual(plain(api.get().userInputs), {});
  assert.equal(api.get().workflowState, 'selected');
  api.reset();
  assert.equal(api.get().selectedGpId, null);
  assert.equal(api.get().workflowState, 'idle');
});

test('contains no persistence or network primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
