import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('core-engine.js', 'utf8');

function engine() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_CORE_ENGINE;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('prepares a v7 execution envelope from shared context', () => {
  const context = {
    query: 'ตรวจร่าง TOR', selectedGpId: 'GP009', category: 'พัสดุ',
    userInputs: { รายการพัสดุ: 'ตัวอย่าง' },
    routing: { score: 0.42, confidence: 0.42, matchedReason: 'matched GP009', fallback: false },
    evidence: { provided: true, types: ['เอกสารอ้างอิง'], count: 1, records: [], requiredTypes: [] },
    legalTransition: { precedentReliedOn: false },
    riskFlags: ['review-required'], workflowState: 'generated'
  };
  const envelope = engine().prepare(context);
  assert.equal(envelope.version, 7);
  assert.deepEqual(plain(envelope.task), { query: 'ตรวจร่าง TOR', selectedGpId: 'GP009', category: 'พัสดุ' });
  assert.deepEqual(plain(envelope.legalTransition), { precedentReliedOn: false });
  assert.deepEqual(plain(envelope.evidence), { provided: true, types: ['เอกสารอ้างอิง'], count: 1, records: [], requiredTypes: [] });
});

test('is deterministic, immutable, and does not mutate shared context', () => {
  const api = engine();
  const context = { query: 'TOR', selectedGpId: 'GP009', userInputs: { วงเงิน: '1000' }, legalTransition: { precedentReliedOn: true } };
  const before = structuredClone(context);
  const first = api.prepare(context);
  assert.deepEqual(plain(first), plain(api.prepare(context)));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.userInputs), true);
  assert.equal(Object.isFrozen(first.legalTransition), true);
  assert.throws(() => { first.userInputs.วงเงิน = '2000'; }, TypeError);
  assert.deepEqual(context, before);
});

test('uses safe defaults when context is absent', () => {
  const envelope = engine().prepare();
  assert.deepEqual(plain(envelope.task), { query: '', selectedGpId: null, category: null });
  assert.deepEqual(plain(envelope.userInputs), {});
  assert.deepEqual(plain(envelope.legalTransition), {});
  assert.equal(envelope.workflowState, 'idle');
});

test('contains no persistence or network primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
