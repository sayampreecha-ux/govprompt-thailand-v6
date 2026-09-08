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

test('starts with immutable v7 state including legal transition state', () => {
  const snapshot = contextApi().get();
  assert.equal(snapshot.version, 7);
  assert.equal(snapshot.query, '');
  assert.equal(snapshot.selectedGpId, null);
  assert.deepEqual(plain(snapshot.legalTransition), {});
  assert.equal(snapshot.workflowState, 'idle');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.legalTransition), true);
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

test('records legal transition state and detects precedent language from user inputs', () => {
  const api = contextApi();
  api.selectTool({ id: 'GP005', category: 'กฎหมาย' });
  api.setUserInputs({ เรื่อง: 'วิเคราะห์คำพิพากษาศาลปกครองสูงสุด อ.24/2567', ข้อเท็จจริง: 'มีหนังสือ มท 0808.2/ว 0679 ภายหลัง' });
  const snapshot = api.get();
  assert.equal(snapshot.legalTransition.precedentReliedOn, true);
  assert.equal(snapshot.legalTransition.laterAuthoritySearchCompleted, false);
  assert.equal(snapshot.legalTransition.ruleVersionCheckCompleted, false);
  assert.equal(snapshot.legalTransition.contraryEvidenceCheckCompleted, false);
});

test('allows explicit transition updates and reset', () => {
  const api = contextApi();
  api.setLegalTransition({ precedentReliedOn: true, precedentFactDate: '2017-01-01', currentFactDate: '2026-09-08' });
  assert.equal(api.get().legalTransition.precedentFactDate, '2017-01-01');
  api.reset();
  assert.deepEqual(plain(api.get().legalTransition), {});
  assert.equal(api.get().workflowState, 'idle');
});

test('contains no persistence or network primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
