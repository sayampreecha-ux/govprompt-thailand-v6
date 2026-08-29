import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('workflow-orchestration.js', 'utf8');
function api() { const context = { window: {} }; vm.createContext(context); vm.runInContext(source, context); return context.window.GOVPROMPT_WORKFLOW_ORCHESTRATION; }

test('provides missing-catalog skeletons without inventing GP support', () => {
  const result = api().skeleton('personnel');
  assert.equal(result.status, 'MISSING_CATALOG');
  assert.deepEqual(JSON.parse(JSON.stringify(result.supportedGpIds)), []);
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.deliverable.state, 'NOT_READY');
});

test('creates handoff only after a supported source is ready and a human confirms', () => {
  const plan = { workflowId: 'tor-procurement', selectedGpId: 'GP009', status: 'READY_FOR_REVIEW', deliverable: { state: 'READY_FOR_HUMAN_REVIEW' }, requiredEvidence: [{ type: 'market-information', provided: true }], riskFlags: ['source-verification'] };
  assert.equal(api().createHandoff(plan, 'legal-analysis', false).status, 'BLOCKED');
  const result = api().createHandoff(plan, 'legal-analysis', true);
  assert.equal(result.status, 'READY_FOR_HUMAN_REVIEW');
  assert.deepEqual(JSON.parse(JSON.stringify(result.context)), { selectedGpId: 'GP009', category: null, evidenceTypes: ['market-information'], riskFlags: ['source-verification'] });
  assert.equal(Object.isFrozen(result), true);
});

test('blocks unsupported or incomplete handoffs deterministically', () => {
  const plan = { workflowId: 'legal-analysis', status: 'NEEDS_INFO', deliverable: { state: 'NOT_READY' } };
  const first = api().createHandoff(plan, 'official-letter-follow-up', true);
  assert.equal(first.status, 'BLOCKED');
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(api().createHandoff(plan, 'official-letter-follow-up', true))));
});

test('contains no persistence, network, or credentials primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  assert.doesNotMatch(source, /\b(api[_-]?key|access[_-]?token|secret)\b/i);
});
