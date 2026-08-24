import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('core-engine.js', 'utf8');

function engine() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.GOVPROMPT_CORE_ENGINE;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers exactly ten government smart actions without adding menu items', () => {
  const actions = plain(engine().smartActions);
  assert.equal(actions.length, 10);
  assert.deepEqual(actions.map(action => action.id), [
    'executive-summary',
    'targeted-document-search',
    'regulation-extractor',
    'document-comparison',
    'risk-audit',
    'tor-boq-review',
    'contract-review',
    'budget-analysis',
    'meeting-minutes',
    'executive-brief'
  ]);
});

test('detects TOR/BOQ as the specialized procurement smart action', () => {
  const detected = engine().detectSmartAction({
    query: 'ช่วยตรวจ TOR เสาไฟโซลาร์เซลล์และ BOQ ว่ามีจุดล็อกสเปกไหม',
    selectedGpId: 'GP009',
    category: 'พัสดุ'
  });
  assert.equal(detected.actionId, 'tor-boq-review');
  assert.equal(detected.fallback, false);
  assert.ok(detected.confidence > 0);
});

test('detects meeting minutes and executive brief from existing GP tools', () => {
  assert.equal(engine().detectSmartAction({ query: 'สรุปรายงานการประชุมและมติ', selectedGpId: 'GP004' }).actionId, 'meeting-minutes');
  assert.equal(engine().detectSmartAction({ query: 'ทำบันทึกเสนอผู้บริหารเพื่อขอมติ', selectedGpId: 'GP002' }).actionId, 'executive-brief');
});

test('detects regulation extraction and requires official-source verification', () => {
  const api = engine();
  const detected = api.detectSmartAction({ query: 'ตรวจข้อกฎหมายและระเบียบที่เกี่ยวข้อง', selectedGpId: 'GP005' });
  assert.equal(detected.actionId, 'regulation-extractor');
  const plan = plain(api.planSmartAction(detected.actionId, { selectedGpId: 'GP005', evidence: { types: ['facts'] } }));
  assert.equal(plan.routeMode, 'web-when-needed');
  assert.ok(plan.qualityGates.includes('official-source-verification'));
  assert.ok(plan.qualityGates.includes('human-review'));
  assert.ok(plan.missingEvidence.includes('law-or-regulation-source'));
});

test('uses attached-file-first, no invented facts, PDPA and human review safeguards', () => {
  const plan = plain(engine().planSmartAction('contract-review', { evidence: { types: ['contract-document'] } }));
  assert.equal(plan.missingEvidence.length, 0);
  assert.ok(plan.constraints.includes('attached-file-first'));
  assert.ok(plan.constraints.includes('no-invented-facts'));
  assert.ok(plan.qualityGates.includes('pdpa-check'));
  assert.equal(plan.requiresHumanReview, true);
});

test('supports explicit action selection but falls back safely when nothing matches', () => {
  const api = engine();
  assert.equal(api.detectSmartAction({ smartActionId: 'budget-analysis' }).actionId, 'budget-analysis');
  assert.deepEqual(plain(api.detectSmartAction({ query: 'สวัสดี' })), {
    actionId: null, label: null, score: 0, confidence: 0, matchedReason: '', fallback: true
  });
});
