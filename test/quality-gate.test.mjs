import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('quality-gate.js', 'utf8');

function gate() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_QUALITY_GATE;
}

function envelope(overrides = {}) {
  return {
    task: { selectedGpId: 'GP009' }, userInputs: { เรื่อง: 'ข้อมูลตัวอย่าง' },
    routing: { confidence: 0.42, fallback: false }, evidence: { provided: false, count: 0, types: [] },
    riskFlags: [], ...overrides
  };
}

test('returns PASS for complete, routable, low-risk input', () => {
  const result = gate().evaluate(envelope());
  assert.equal(result.status, 'PASS');
  assert.equal(result.checks.workflowReadiness.ready, true);
  assert.equal(Object.isFrozen(result), true);
});

test('returns BLOCKED for a missing GP selection or routing fallback', () => {
  assert.equal(gate().evaluate(envelope({ task: { selectedGpId: null } })).status, 'BLOCKED');
  assert.equal(gate().evaluate(envelope({ routing: { confidence: 0, fallback: true } })).status, 'BLOCKED');
});

test('returns NEEDS_INFO for missing input or required evidence', () => {
  assert.equal(gate().evaluate(envelope({ userInputs: {} })).status, 'NEEDS_INFO');
  assert.equal(gate().evaluate(envelope({ riskFlags: ['evidence-required'] })).status, 'NEEDS_INFO');
});

test('returns REVIEW_REQUIRED for risks, low confidence, and PDPA-sensitive fields', () => {
  assert.equal(gate().evaluate(envelope({ riskFlags: ['review-required'] })).status, 'REVIEW_REQUIRED');
  assert.equal(gate().evaluate(envelope({ routing: { confidence: 0.2, fallback: false } })).status, 'REVIEW_REQUIRED');
  assert.equal(gate().evaluate(envelope({ userInputs: { เลขบัตรประชาชน: '[redacted]' } })).status, 'REVIEW_REQUIRED');
});

test('hardens evidence readiness with metadata-only verification states', () => {
  const result = gate().evaluate(envelope({ evidence: { provided: true, count: 1, types: ['facts'], requiredTypes: ['facts'], records: [{ type: 'facts', status: 'needs-verification' }] } }));
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.deepEqual(JSON.parse(JSON.stringify(result.checks.requiredEvidence.unverifiedTypes)), ['facts']);
  assert.equal(result.checks.sourceReadiness.verificationReady, false);
  assert.equal(gate().evaluate(envelope({ evidence: { provided: true, count: 1, requiredTypes: ['facts'], records: [] } })).status, 'NEEDS_INFO');
});

test('reports catalog unavailable or not applicable without a substantive decision', () => {
  assert.equal(gate().evaluate(envelope({ catalogStatus: 'MISSING_CATALOG' })).status, 'MISSING_CATALOG');
  assert.equal(gate().evaluate(envelope({ catalogStatus: 'NOT_APPLICABLE' })).status, 'NOT_APPLICABLE');
});

test('contains no persistence or network primitives', () => {
  assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/);
});
