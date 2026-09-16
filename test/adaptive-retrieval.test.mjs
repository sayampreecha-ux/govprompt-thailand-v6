import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function load(path, exportName) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(path, 'utf8'), context);
  return context.window[exportName];
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('adaptive retrieval starts FAST_VERIFY and preserves compatibility flow', () => {
  const gate = load('core-engine.js', 'GOVPROMPT_CORE_ENGINE').officialAuthorityRetrievalGate;
  const result = gate.evaluateScope({
    query: 'ช่วยตรวจหนังสือสั่งการนี้ว่าถูกต้องหรือไม่',
    evidence: { provided: true, count: 1, types: ['official-letter'] }
  });

  assert.equal(result.status, 'SEARCH_READY');
  assert.equal(result.retrievalLevel, 'FAST_VERIFY');
  assert.equal(result.suppliedEvidence.provided, true);
  assert.deepEqual(plain(result.retrievalFlow), [
    'PROVIDED_EVIDENCE',
    'PRIMARY_RULE',
    'DIRECTLY_CITED_DOCUMENT',
    'LATER_CHANGE_CHECK',
    'FACT_MATCH',
    'TARGETED_CONTRARY_CHECK',
    'ANSWER'
  ]);
  assert.equal(gate.searchBudget.fastQueries, 5);
  assert.deepEqual(plain(gate.retrievalFlow), [
    'CURRENT_RULE','LATER_RULE_OR_AMENDMENT','TEMPORARY_MEASURE_OR_EXCEPTION','EXPIRY_OR_TRANSITION',
    'OFFICIAL_GUIDANCE_OR_PRECEDENT_WHEN_RELEVANT','CONFLICT_CHECK','CONTRARY_EVIDENCE_CHECK','APPLICABLE_RULE','DECISION_FACTS','FINAL_DECISION'
  ]);
});

test('adaptive policy prevents automatic FULL search while retaining legal quality gates', () => {
  const gate = load('core-engine.js', 'GOVPROMPT_CORE_ENGINE').officialAuthorityRetrievalGate;
  const policy = gate.promptPolicy({ query: 'ค่า K เบิกได้ไหม', category: 'การเงิน' });

  assert.match(policy, /High Risk ≠ Full Search/);
  assert.match(policy, /Search Budget รอบแรก/);
  assert.match(policy, /STOP SEARCH/);
  assert.match(policy, /Decision Lock บล็อกเฉพาะการฟันธง/);
  assert.match(policy, /Decision Gate, Multi-condition Gate, Legal Version Gate, Evidence Gate, Applicable Authority Check, Contrary Evidence Check และ Human Approval/);
  assert.match(policy, /ห้าม hard-code/);
});

test('high-risk final-decision lock allows partial verified work instead of blocking the whole workflow', () => {
  const gate = load('quality-gate.js', 'GOVPROMPT_QUALITY_GATE');
  const result = gate.evaluate({
    task: { selectedGpId: 'GP005' },
    userInputs: { เรื่อง: 'ตรวจแนวทางปฏิบัติ' },
    routing: { confidence: 0.9, fallback: false },
    evidence: { provided: false, count: 0, types: [] },
    riskFlags: ['decision-integrity-required'],
    decisionIntegrity: {
      enabled: true,
      factsChecked: false,
      applicableAuthorityChecked: false,
      legalVersionChecked: false,
      ruleChainChecked: false,
      counterCheckCompleted: false,
      primarySourceChecked: false,
      unresolvedPotentialReversals: [],
      conclusionLevel: null
    }
  });

  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.decisionLock, true);
  assert.equal(result.partialAnswerAllowed, true);
  assert.equal(result.checks.partialAnswerReadiness.ready, true);
});

test('legal workflow treats missing searchable authority as retrieval work, not a missing-facts blocker', () => {
  const workflow = load('workflow-expansion.js', 'GOVPROMPT_WORKFLOW_EXPANSION');
  const result = workflow.plan({
    task: { selectedGpId: 'GP005', query: 'แนวทางปฏิบัติถูกต้องหรือไม่' },
    userInputs: {
      เรื่อง: 'ตรวจแนวทางปฏิบัติ',
      ข้อเท็จจริง: 'มีข้อเท็จจริงเพียงพอสำหรับเริ่มค้น',
      ข้อหารือ: 'แนวทางปฏิบัติถูกต้องหรือไม่'
    },
    evidence: { provided: false, count: 0, types: [] },
    riskFlags: []
  }, {
    status: 'PASS',
    checks: { missingInformation: [], riskFlags: [], pdpaSecurity: { concerns: [] } }
  });

  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.currentState, 'risk-review');
  assert.deepEqual(plain(result.searchableMissingEvidence), ['authority-or-source-provided']);
  assert.equal(result.nextAction, 'RETRIEVE_SEARCHABLE_AUTHORITY');
  assert.deepEqual(plain(result.missingInformation), []);
});

test('shared context records evidence metadata for retrieval without persistence', () => {
  const context = load('shared-context.js', 'GOVPROMPT_CONTEXT');
  context.setEvidence({ provided: true, count: 1, types: ['official-letter'] });
  const snapshot = context.get();

  assert.equal(snapshot.evidence.provided, true);
  assert.equal(snapshot.evidence.count, 1);
  assert.deepEqual(plain(snapshot.evidence.types), ['official-letter']);
});
