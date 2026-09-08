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

test('infers precedent reliance from a real high-risk user question and blocks before conclusion', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
    userInputs: {
      เรื่อง: 'สิทธิเบิกค่าเช่าซื้อบ้าน',
      ข้อเท็จจริง: 'มีคำพิพากษาศาลปกครองสูงสุดเดิม และต่อมามีหนังสือกระทรวงมหาดไทยออกภายหลัง',
      ข้อหารือ: 'ยังเบิกได้หรือไม่'
    },
    evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
  }, qualityPass);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.decisionLock, true);
  assert.equal(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
  assert.ok(result.authorityTransition.blockers.includes('later-authority-search-not-completed'));
  assert.ok(result.authorityTransition.blockers.includes('rule-version-check-not-completed'));
  assert.ok(result.authorityTransition.blockers.includes('contrary-evidence-check-not-completed'));
});

test('infers official-consultation precedent in finance and blocks even without explicit transition object', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP019', category: 'การเงิน' },
    userInputs: { ข้อหารือ: 'มีหนังสือหารือเดิมให้เบิกได้ ต้องใช้แนวเดิมหรือไม่' },
    evidence: { types: ['payment-request', 'supporting-documents', 'approval-reference'] }
  }, qualityPass);
  assert.equal(result.decisionLock, true);
  assert.equal(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});

test('ordinary high-risk question without precedent signal is not falsely transition-blocked', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
    userInputs: { เรื่อง: 'ตรวจอำนาจตามระเบียบปัจจุบัน', ข้อหารือ: 'หน่วยงานมีอำนาจหรือไม่' },
    evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
  }, qualityPass);
  assert.notEqual(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});
