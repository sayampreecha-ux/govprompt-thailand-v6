import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('catalog-reconciliation.js', 'utf8');
const indexHtml = readFileSync('index.html', 'utf8');
const catalog = JSON.parse(indexHtml.match(/window\.GOVPROMPT_TOOLS=(\[.*?\]);/)?.[1] || '[]');

function api() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_CATALOG_RECONCILIATION;
}

test('reconciles the repository catalog without inventing missing GPs', () => {
  const result = api().reconcile(catalog);
  assert.equal(result.summary.present, 20);
  assert.equal(result.summary.missing, 202);
  assert.deepEqual([...result.present], Array.from({ length: 20 }, (_, index) => `GP${String(index + 1).padStart(3, '0')}`));
  assert.equal(result.missing[0], 'GP021');
  assert.equal(result.missing.at(-1), 'GP222');
  assert.deepEqual([...result.duplicate], []);
  assert.deepEqual([...result.conflict], []);
  assert.equal(Object.isFrozen(result), true);
});

test('reports duplicate and conflicting catalog entries deterministically', () => {
  const result = api().reconcile([{ id: 'GP001', name: 'same' }, { id: 'GP001', name: 'different' }]);
  assert.deepEqual([...result.duplicate], ['GP001']);
  assert.deepEqual([...result.conflict], ['GP001']);
});

test('contains no persistence, network, or credentials primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  assert.doesNotMatch(source, /\b(api[_-]?key|access[_-]?token|secret)\b/i);
});
