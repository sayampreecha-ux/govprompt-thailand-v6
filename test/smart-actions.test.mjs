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

test('infers TOR and budget evidence from current GP009 form inputs', () => {
  const api = engine();
  const types = api.inferEvidenceTypes({
    selectedGpId: 'GP009',
    userInputs: {
      'ข้อความ TOR': 'กำหนดคุณลักษณะโคมไฟและเงื่อนไขตรวจรับ',
      'วงเงิน': '500000'
    }
  }, 'tor-boq-review');
  assert.ok(types.includes('tor-or-specification'));
  assert.ok(types.includes('budget-or-boq'));
  const plan = plain(api.planSmartAction('tor-boq-review', {
    selectedGpId: 'GP009',
    userInputs: { 'ข้อความ TOR': 'กำหนดสเปกและตรวจรับ', 'วงเงิน': '500000' }
  }));
  assert.equal(plan.missingEvidence.length, 0);
});

test('uses attached-file-first, no invented facts, PDPA and human review safeguards', () => {
  const plan = plain(engine().planSmartAction('contract-review', { evidence: { types: ['contract-document'] } }));
  assert.equal(plan.missingEvidence.length, 0);
  assert.ok(plan.constraints.includes('attached-file-first'));
  assert.ok(plan.constraints.includes('no-invented-facts'));
  assert.ok(plan.qualityGates.includes('pdpa-check'));
  assert.equal(plan.requiresHumanReview, true);
});

test('builds a complete TOR smart-action prompt with official-source and quality gates', () => {
  const api = engine();
  const result = api.buildSmartActionPrompt({
    query: 'ตรวจ TOR และ BOQ',
    selectedGpId: 'GP009',
    category: 'พัสดุ',
    userInputs: { 'ข้อความ TOR': 'กำหนดสเปกพร้อมเงื่อนไขตรวจรับ', 'วงเงิน': '500000' }
  }, 'BASE PROMPT');
  assert.match(result, /BASE PROMPT/);
  assert.match(result, /SMART ACTION — ระบบเลือกอัตโนมัติ/);
  assert.match(result, /ตรวจ TOR และ BOQ/);
  assert.match(result, /แหล่งราชการหรือต้นฉบับ/);
  assert.match(result, /PDF, Word, Excel/);
  assert.match(result, /pdpa-check/);
  assert.match(result, /human-review/);
  assert.match(result, /ความสอดคล้องของปริมาณ\/ราคา/);
});

test('builds meeting smart-action prompt without forcing web search', () => {
  const api = engine();
  const result = api.buildSmartActionPrompt({
    query: 'สรุปรายงานการประชุมและมติ',
    selectedGpId: 'GP004',
    userInputs: { 'บันทึกประชุม': 'ที่ประชุมมีมติให้กองช่างดำเนินการภายใน 30 วัน' }
  }, 'BASE');
  assert.match(result, /สรุปรายงานการประชุมและมติ/);
  assert.match(result, /ไม่ค้นเว็บโดยอัตโนมัติ/);
  assert.match(result, /ผู้รับผิดชอบ/);
  assert.match(result, /กำหนดเวลา/);
});

test('supports explicit action selection but falls back safely when nothing matches', () => {
  const api = engine();
  assert.equal(api.detectSmartAction({ smartActionId: 'budget-analysis' }).actionId, 'budget-analysis');
  assert.deepEqual(plain(api.detectSmartAction({ query: 'สวัสดี' })), {
    actionId: null, label: null, score: 0, confidence: 0, matchedReason: '', fallback: true
  });
  assert.equal(api.buildSmartActionPrompt({ query: 'สวัสดี' }, 'BASE'), 'BASE');
});
