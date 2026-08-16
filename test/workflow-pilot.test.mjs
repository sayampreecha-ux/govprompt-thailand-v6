import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('workflow-pilot.js', 'utf8');

function workflow() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_WORKFLOW_PILOT;
}

test('plans the official-letter pilot only for GP001', () => {
  const result = workflow().plan({ task: { selectedGpId: 'GP001' } }, { status: 'PASS' });
  assert.equal(result.workflowId, 'official-letter-draft-pilot');
  assert.equal(result.status, 'READY_FOR_REVIEW');
  assert.deepEqual([...result.steps], ['review-inputs', 'generate-existing-prompt', 'human-review']);
  assert.equal(result.requiresHumanReview, true);
  assert.equal(Object.isFrozen(result), true);
});

test('maps every Quality Gate status deterministically', () => {
  const api = workflow();
  const input = { task: { selectedGpId: 'GP001' } };
  assert.equal(api.plan(input, { status: 'NEEDS_INFO' }).status, 'NEEDS_INFO');
  assert.equal(api.plan(input, { status: 'REVIEW_REQUIRED' }).status, 'REVIEW_REQUIRED');
  assert.equal(api.plan(input, { status: 'BLOCKED' }).status, 'BLOCKED');
  assert.deepEqual([...api.plan(input, { status: 'BLOCKED' }).steps], []);
});

test('does not apply the pilot to another GP', () => {
  const result = workflow().plan({ task: { selectedGpId: 'GP009' } }, { status: 'PASS' });
  assert.equal(result.status, 'NOT_APPLICABLE');
  assert.deepEqual([...result.steps], []);
});

test('contains no persistence or network primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
