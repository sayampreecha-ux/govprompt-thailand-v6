import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('workflow-expansion.js', 'utf8');

function workflow() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_WORKFLOW_EXPANSION;
}

function envelope(selectedGpId, overrides = {}) {
  return {
    task: { selectedGpId },
    evidence: { types: [], count: 0, provided: false },
    riskFlags: [],
    ...overrides
  };
}

function quality(status, overrides = {}) {
  return { status, checks: { missingInformation: [], riskFlags: [], pdpaSecurity: { concerns: [] }, ...overrides } };
}

test('maps the existing GP catalog to all four Batch 1 workflows', () => {
  const api = workflow();
  assert.equal(api.plan(envelope('GP009'), quality('PASS')).workflowId, 'tor-procurement');
  assert.equal(api.plan(envelope('GP019'), quality('PASS')).workflowId, 'financial-disbursement');
  assert.equal(api.plan(envelope('GP005'), quality('PASS')).workflowId, 'legal-analysis');
  assert.equal(api.plan(envelope('GP001'), quality('PASS')).workflowId, 'official-letter-follow-up');
});

test('exposes deterministic states, evidence, risk gates, deliverables, and human handoffs', () => {
  const api = workflow();
  const result = api.plan(envelope('GP009', { evidence: { types: ['requirement-specification'], count: 1, provided: true } }), quality('PASS'));
  assert.equal(result.status, 'READY_FOR_REVIEW');
  assert.equal(result.currentState, 'human-review');
  assert.equal(result.requiresHumanReview, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.requiredEvidence)), [
    { type: 'requirement-specification', provided: true },
    { type: 'market-information', provided: false },
    { type: 'budget-basis', provided: false }
  ]);
  assert.equal(result.deliverable.state, 'READY_FOR_HUMAN_REVIEW');
  assert.deepEqual(JSON.parse(JSON.stringify(result.handoff.allowedTargets)), ['legal-analysis', 'official-letter-follow-up']);
  assert.equal(result.handoff.requiresHumanDecision, true);
  assert.equal(Object.isFrozen(result), true);
});

test('propagates quality outcomes without making a substantive decision', () => {
  const api = workflow();
  assert.equal(api.plan(envelope('GP005'), quality('NEEDS_INFO', { missingInformation: ['facts'] })).status, 'NEEDS_INFO');
  assert.equal(api.plan(envelope('GP005'), quality('NEEDS_INFO')).currentState, 'collecting-evidence');
  assert.equal(api.plan(envelope('GP005'), quality('REVIEW_REQUIRED', { riskFlags: ['source-verification'] })).currentState, 'risk-review');
  assert.equal(api.plan(envelope('GP005'), quality('BLOCKED')).deliverable.state, 'BLOCKED');
});

test('returns NOT_APPLICABLE for unrelated existing GPs and keeps results deterministic', () => {
  const api = workflow();
  const input = envelope('GP016');
  assert.equal(api.plan(input, quality('PASS')).status, 'NOT_APPLICABLE');
  assert.deepEqual(api.plan(input, quality('PASS')), api.plan(input, quality('PASS')));
});

test('contains no persistence, network, or credentials primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
  assert.doesNotMatch(source, /\b(api[_-]?key|access[_-]?token|secret)\b/i);
});
