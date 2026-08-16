import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('evidence-collection.js', 'utf8');
function api() { const context = { window: {} }; vm.createContext(context); vm.runInContext(source, context); return context.window.GOVPROMPT_EVIDENCE; }

test('classifies and retains only safe memory-only evidence metadata', () => {
  const result = api().create([{ type: 'market-information', status: 'supplied' }, { type: 'person-name', status: 'needs-verification' }, { type: 'national-id', status: 'verified-by-human' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [{ type: 'market-information', classification: 'SAFE', status: 'supplied' }, { type: 'person-name', classification: 'SENSITIVE', status: 'needs-verification' }]);
  assert.equal(Object.isFrozen(result), true);
});

test('uses missing as deterministic default and deduplicates types', () => {
  const result = api().create([{ type: 'facts' }, { type: 'facts', status: 'supplied' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [{ type: 'facts', classification: 'SAFE', status: 'missing' }]);
});

test('contains no persistence, network, or credentials primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  assert.doesNotMatch(source, /\b(api[_-]?key|access[_-]?token|secret)\b/i);
});
