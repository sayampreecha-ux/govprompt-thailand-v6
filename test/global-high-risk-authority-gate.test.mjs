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

for (const category of ['กฎหมาย', 'การเงิน', 'การคลัง', 'พัสดุ', 'บุคคล', 'งบประมาณ', 'สภาท้องถิ่น']) {
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
    assert.equal(result.highRiskAccuracy.applicable, true);
    assert.ok(result.riskGates.some(g => g.gate === 'global-high-risk-authority-transition' && g.triggered));
    assert.ok(result.riskGates.some(g => g.gate === 'global-high-risk-accuracy' && g.triggered));
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

test('allows resolved authority transition to continue while retaining accuracy rules', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
    authorityTransition: resolvedTransition(),
    evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
  }, qualityPass);
  assert.equal(result.decisionLock, false);
  assert.equal(result.authorityTransition.pass, true);
  assert.equal(result.status, 'READY_FOR_REVIEW');
  assert.equal(result.highRiskAccuracy.applicable, true);
  assert.equal(result.highRiskAccuracy.rules.length, 5);
});

test('does not invoke transition gate without precedent reliance but applies high-risk accuracy rules', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
    authorityTransition: { precedentReliedOn: false },
    evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
  }, qualityPass);
  assert.equal(result.decisionLock, false);
  assert.equal(result.status, 'READY_FOR_REVIEW');
  assert.equal(result.highRiskAccuracy.applicable, true);
});

test('non-high-risk categories are not blocked or burdened by high-risk controls', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP004', category: 'ประชาสัมพันธ์' },
    authorityTransition: blockedTransition(),
    evidence: { types: ['facts', 'recipient-or-destination', 'reference-documents'] }
  }, qualityPass);
  assert.notEqual(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
  assert.equal(result.highRiskAccuracy.applicable, false);
});

test('infers precedent reliance from a real house-purchase allowance question', () => {
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

test('infers official-consultation precedent in finance without explicit transition object', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP019', category: 'การเงิน' },
    userInputs: { ข้อหารือ: 'มีหนังสือหารือเดิมให้เบิกได้ ต้องใช้แนวเดิมหรือไม่' },
    evidence: { types: ['payment-request', 'supporting-documents', 'approval-reference'] }
  }, qualityPass);
  assert.equal(result.decisionLock, true);
  assert.equal(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});

for (const wording of [
  'เมื่อก่อนเคยตอบว่าเบิกได้ ตอนนี้ยังใช้ได้ไหม',
  'แนวเดิมเคยอนุมัติไว้ ปัจจุบันทำตามเดิมได้หรือไม่',
  'เคสเดิมให้ดำเนินการได้ กรณีนี้ใช้หลักเดียวกันไหม',
  'บรรทัดฐานเดิมเป็นแบบนี้ แต่ตอนนี้มีกฎใหม่หรือไม่'
]) {
  test(`infers semantic prior-authority wording: ${wording}`, () => {
    const result = workflow.plan({
      task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
      userInputs: { ข้อหารือ: wording },
      evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
    }, qualityPass);
    assert.equal(result.decisionLock, true);
    assert.equal(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
  });
}

test('recognizes high risk from task.domains array', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP222', domains: ['engineering', 'finance', 'personnel'] },
    userInputs: { ข้อหารือ: 'มีแนวเดิมให้เบิกได้ ปัจจุบันยังใช้ได้หรือไม่' }
  }, qualityPass);
  assert.equal(result.highRiskAccuracy.applicable, true);
  assert.equal(result.decisionLock, true);
  assert.equal(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});

test('recognizes high risk from top-level domains array without workflow definition', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP222' },
    domains: ['public-health', 'budget'],
    userInputs: { เรื่อง: 'ตรวจงบประมาณตามระเบียบปัจจุบัน' }
  }, qualityPass);
  assert.equal(result.highRiskAccuracy.applicable, true);
  assert.equal(result.decisionLock, false);
});

test('ordinary high-risk question is not transition-blocked but receives anti-hallucination rules', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', category: 'กฎหมาย' },
    userInputs: { เรื่อง: 'ตรวจอำนาจตามระเบียบปัจจุบัน', ข้อหารือ: 'หน่วยงานมีอำนาจหรือไม่' },
    evidence: { types: ['facts', 'authority-or-source-provided', 'question-for-review'] }
  }, qualityPass);
  assert.notEqual(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
  assert.equal(result.highRiskAccuracy.applicable, true);
  assert.ok(result.highRiskAccuracy.rules.some(rule => rule.includes('ห้ามสร้างหรือเดาเลขหนังสือ')));
  assert.ok(result.highRiskAccuracy.rules.some(rule => rule.includes('วันที่เกิดเหตุ')));
  assert.ok(result.highRiskAccuracy.rules.some(rule => rule.includes('ผลตรงข้าม')));
  assert.ok(result.highRiskAccuracy.rules.some(rule => rule.includes('UNVERIFIED')));
});

test('travel reimbursement prior-answer wording triggers transition review', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP019', categories: ['การเงิน', 'บุคคล'] },
    userInputs: { เรื่อง: 'ไปรายงานตัวสอบคัดเลือก', ข้อหารือ: 'เมื่อก่อนเคยตอบว่าเบิกค่าเดินทางได้ ตอนนี้ยังใช้แนวเดิมได้ไหม' }
  }, qualityPass);
  assert.equal(result.highRiskAccuracy.applicable, true);
  assert.equal(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});

test('local council revenue amendment receives high-risk accuracy without false transition block', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP222', domains: ['council', 'budget', 'legal'] },
    userInputs: { เรื่อง: 'ประมาณการรายรับพิมพ์ผิด', ข้อหารือ: 'แก้ในชั้นแปรญัตติได้หรือไม่' }
  }, qualityPass);
  assert.equal(result.highRiskAccuracy.applicable, true);
  assert.equal(result.decisionLock, false);
  assert.notEqual(result.workflowStatus, 'BLOCKED_LATER_AUTHORITY_CHECK');
});

test('low-risk PR question does not receive high-risk accuracy rules', () => {
  const result = workflow.plan({
    task: { selectedGpId: 'GP004', category: 'ประชาสัมพันธ์' },
    userInputs: { เรื่อง: 'ร่างข่าวประชาสัมพันธ์กิจกรรม' },
    evidence: { types: ['facts', 'recipient-or-destination', 'reference-documents'] }
  }, qualityPass);
  assert.equal(result.highRiskAccuracy.applicable, false);
  assert.equal(result.highRiskAccuracy.rules.length, 0);
});
