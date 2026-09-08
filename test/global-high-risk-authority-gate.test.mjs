import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workflow = require('../workflow-expansion.js');

const blockedTransition = () => ({
  precedentReliedOn: true,
  precedentFactDate: '2017-01-01',
  currentFactDate: '2026-09-08',
  laterAuthoritySearchCompleted: true,
  ruleVersionCheckCompleted: true,
  contraryEvidenceCheckCompleted: true,
  laterAuthorities: [{ id: 'later-authority', date: '2018-02-06', relevant: true, transitionResolved: false }]
});

const resolvedTransition = () => ({
  ...blockedTransition(),
  laterAuthorities: [{ id: 'later-authority', date: '2018-02-06', relevant: true, transitionResolved: true }]
});

const qualityPass = { status: 'PASS', checks: { missingInformation: [], riskFlags: [], pdpaSecurity: { concerns: [] } } };

for (const category of ['กฎหมาย', 'การเงิน', 'พัสดุ', 'บุคคล', 'งบประมาณ', 'สภาท้องถิ่น']) {
  test(`blocks unresolved precedent transition globally for ${category}`, () => {
    const result = workflow.plan({
      task: { selectedGpId: 'GP005', category },
      authorityTransition: blockedTransition(),
      evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
    }, qualityPass);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.decisionLock, true);
    assert.equal(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
    assert.equal(result.nextAction, 'EXECUTE_LATER_AUTHORITY_TRANSITION_CHECK');
    assert.ok(result.riskGates.some(g => g.gate === 'global-high-risk-authority-transition' && g.triggered));
  });
}

test('blocks high-risk category even when selected GP has no workflow definition', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP222', category: 'บุคคล' },
    authorityTransition: blockedTransition()
  }, qualityPass);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.decisionLock, true);
  assert.equal(result.deliverable.state, 'BLOCKED');
});

test('allows resolved authority transition to continue into normal workflow', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
    authorityTransition: resolvedTransition(),
    evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
  }, qualityPass);
  assert.equal(result.decisionLock, false);
  assert.equal(result.authorityTransition.pass, true);
  assert.equal(result.status, 'READY_FOR_REVIEW');
});

test('does not invoke transition gate without precedent reliance', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
    authorityTransition: { precedentReliedOn: false },
    evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
  }, qualityPass);
  assert.equal(result.decisionLock, false);
  assert.equal(result.status, 'READY_FOR_REVIEW');
});

test('non-high-risk categories are not blocked by the authority transition gate', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP004', category: 'ประชาสัมพันธ์' },
    authorityTransition: blockedTransition(),
    evidence: { types: ['facts', 'recipient-or-destination', 'reference-documents'] }
  }, qualityPass);
  assert.notEqual(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});
