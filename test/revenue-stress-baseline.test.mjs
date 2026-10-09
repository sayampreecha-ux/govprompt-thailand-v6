import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Revenue Stress Baseline for GovPrompt Thailand V7.1
// Diagnostic only: this file intentionally tests the current Core/Router as-is.
// It must not patch or mutate production logic.

const indexHtml = readFileSync('index.html', 'utf8');
const catalogMatch = indexHtml.match(/window\.GOVPROMPT_TOOLS=(\[.*?\]);/);
const catalog = JSON.parse(catalogMatch?.[1] || '[]');

function routerApi() {
  const context = { window: { GOVPROMPT_TOOLS: structuredClone(catalog) } };
  vm.createContext(context);
  vm.runInContext(readFileSync('gp-router.js', 'utf8'), context);
  return context.window.GOVPROMPT_ROUTER;
}

function authorityApi() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync('core-engine.js', 'utf8'), context);
  return context.window.GOVPROMPT_CORE_ENGINE.officialAuthorityRetrievalGate;
}

function integrated(query) {
  const routed = routerApi().route(query);
  const category = routed?.tool?.category || '';
  const gate = authorityApi();
  return {
    routed,
    category,
    applies: gate.shouldApply({ query, category }),
    scope: gate.evaluateScope({ query }),
    policy: gate.promptPolicy({ query, category })
  };
}

function assertRouted(query) {
  const result = integrated(query);
  assert.equal(result.routed.fallback, false, `Router should not fall back for: ${query}`);
  assert.ok(result.routed.selectedGpId, `Expected a routed GP/domain for: ${query}`);
  return result;
}

function assertAuthoritySearchReady(query) {
  const result = integrated(query);
  assert.equal(result.applies, true, `Official Authority Retrieval should apply for: ${query}`);
  assert.equal(result.scope.subjectIdentifiable, true, `Subject should be identifiable for: ${query}`);
  assert.equal(result.scope.status, 'SEARCH_READY', `Search should start for: ${query}`);
  assert.equal(result.scope.action, 'AUTHORITY_RETRIEVAL', `Expected authority retrieval for: ${query}`);
  assert.ok(result.scope.searchVocabulary.length > 0, `Expected search vocabulary for: ${query}`);
  return result;
}

// R01-R04: management/data-analysis prompts should be understood without forcing legal retrieval.
test('R01 revenue improvement is routed as government work without unnecessary authority retrieval', () => {
  const r = assertRouted('ช่วยเสนอแนวทางเพิ่มประสิทธิภาพการจัดเก็บรายได้ขององค์กรปกครองส่วนท้องถิ่น');
  assert.equal(r.applies, false);
});

test('R02 below-target revenue analysis is routed and does not force authority retrieval', () => {
  const r = assertRouted('รายได้จัดเก็บจริงต่ำกว่าประมาณการ ควรวิเคราะห์อะไรบ้าง');
  assert.equal(r.applies, false);
});

test('R03 five-year revenue analysis is routed and does not invent a legal retrieval need', () => {
  const r = assertRouted('วิเคราะห์รายได้ย้อนหลัง 5 ปีให้หน่อย');
  assert.equal(r.applies, false);
});

test('R04 revenue prioritization is routed as government work', () => {
  const r = assertRouted('รายได้ประเภทไหนควรเร่งรัดก่อน');
  assert.equal(r.applies, false);
});

// R05-R11: legal/financial consequence prompts should trigger authority retrieval when subject is identifiable.
test('R05 land-tax liability triggers authority retrieval before decision', () => {
  const r = assertRouted('ที่ดินกรณีนี้ต้องเสียภาษีหรือไม่');
  assert.equal(r.applies, true);
  assert.equal(r.scope.status, 'SEARCH_READY');
});

test('R06 tax amount/rate question triggers verified authority flow and anti-hard-code policy', () => {
  const r = assertRouted('ภาษีกรณีนี้คิดเท่าไร');
  assert.equal(r.applies, true);
  assert.equal(r.scope.status, 'SEARCH_READY');
  assert.match(r.policy, /ห้าม hard-code/);
  assert.match(r.policy, /Applicable Rule/);
});

test('R07 delinquent-tax procedure triggers authority retrieval', () => {
  const r = assertAuthoritySearchReady('ผู้เสียภาษีค้างชำระต้องดำเนินการอย่างไร');
  assert.match(r.policy, /Current Rule → Later Rule\/Amendment/);
});

test('R08 tax exemption eligibility triggers authority retrieval', () => {
  const r = assertRouted('กรณีนี้ได้รับยกเว้นภาษีไหม');
  assert.equal(r.applies, true);
  assert.equal(r.scope.status, 'SEARCH_READY');
});

test('R09 local fee collection authority triggers authority retrieval', () => {
  const r = assertRouted('อปท. เรียกเก็บค่าธรรมเนียมนี้ได้ไหม');
  assert.equal(r.applies, true);
  assert.equal(r.scope.status, 'SEARCH_READY');
});

test('R10 temporal legal-version question preserves applicability and transition checks', () => {
  const r = assertAuthoritySearchReady('เหตุเกิดปี 2567 แต่ตอนนี้ปี 2569 มีหลักเกณฑ์ใหม่ กรณีนี้ต้องใช้หลักเกณฑ์ฉบับไหน');
  assert.match(r.policy, /วันที่เกิดเหตุ/);
  assert.match(r.policy, /บทเฉพาะกาล/);
  assert.match(r.policy, /(?:ไม่เลือกเอกสาร|ห้ามเลือกฉบับ)ใหม่ที่สุดโดยอัตโนมัติ/);
});

test('R11 ค่า K is searchable even when decisive contract facts are not yet complete', () => {
  const r = assertRouted('ค่า K งานก่อสร้างเบิกได้ไหม');
  assert.equal(r.applies, true);
  assert.equal(r.scope.status, 'SEARCH_READY');
  assert.equal(r.scope.action, 'AUTHORITY_RETRIEVAL');
});

// R12-R14: ambiguity, past practice and conflicting authorities.
test('R12 truly ambiguous fee query clarifies subject instead of searching a guessed matter', () => {
  const scope = authorityApi().evaluateScope({ query: 'ค่า…เก็บได้เท่าไร' });
  assert.equal(scope.subjectIdentifiable, false);
  assert.equal(scope.status, 'BLOCKED_MISSING_SCOPE');
  assert.equal(scope.action, 'CLARIFY_SUBJECT');
  assert.deepEqual(JSON.parse(JSON.stringify(scope.searchVocabulary)), []);
});

test('R13 past-practice-only query is treated as missing subject, not as legal authority', () => {
  const scope = authorityApi().evaluateScope({ query: 'เมื่อก่อนหน่วยงานทำแบบนี้มาตลอด ยังทำต่อได้ไหม' });
  assert.equal(scope.subjectIdentifiable, false);
  assert.equal(scope.status, 'BLOCKED_MISSING_SCOPE');
  assert.equal(scope.action, 'CLARIFY_SUBJECT');
});

test('R14 conflicting official letters trigger conflict and contrary-evidence checks', () => {
  const r = assertAuthoritySearchReady('มีหนังสือสั่งการสองฉบับดูเหมือนขัดกัน ปัจจุบันต้องใช้ฉบับไหน');
  assert.match(r.policy, /(?:Conflict Check|conflict ของ authority)/);
  assert.match(r.policy, /Contrary Evidence Check/);
  assert.match(r.policy, /คง Decision Gate, Multi-condition Gate, Legal Version Gate, Evidence Gate, Applicable Authority Check, Contrary Evidence Check และ Human Approval/);
});

// R15-R20: drafting/planning/data prompts should stay routable and preserve the same Universal Core behavior.
test('R15 delinquency notice drafting remains routable and authority-aware', () => {
  const r = assertRouted('ช่วยร่างหนังสือแจ้งผู้ค้างชำระ');
  assert.equal(r.applies, true);
});

test('R16 management memo on revenue acceleration is routable', () => {
  assertRouted('ทำบันทึกเสนอผู้บริหารเรื่องเร่งรัดรายได้');
});

test('R17 annual revenue-efficiency plan is routable without a revenue-specific module', () => {
  assertRouted('ทำแผนเพิ่มประสิทธิภาพการจัดเก็บรายได้ประจำปี');
});

test('R18 anomaly analysis on supplied revenue data is routable', () => {
  assertRouted('จากข้อมูลรายได้นี้ช่วยหาความผิดปกติ');
});

test('R19 loaded causal premise stays in revenue/finance workflow rather than personnel blame routing', () => {
  const r = assertRouted('รายได้ต่ำกว่าเป้าเพราะเจ้าหน้าที่ทำงานไม่ดีใช่ไหม');
  assert.notEqual(r.routed.selectedGpId, 'DOMAIN_PERSONNEL');
});

test('R20 multi-artifact revenue workflow is routable end-to-end without adding a revenue route', () => {
  const r = assertRouted('จากข้อมูลรายได้ที่ให้ วิเคราะห์ปัญหา แล้วจัดทำบันทึกเสนอผู้บริหาร หนังสือแจ้งผู้เกี่ยวข้อง และแผนติดตามผลให้ครบ');
  assert.ok(r.routed.selectedGpId);
});
