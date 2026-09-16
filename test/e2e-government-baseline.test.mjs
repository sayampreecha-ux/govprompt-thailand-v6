import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Cross-domain E2E baseline for GovPrompt Thailand V7.1.
// Universal regression only: no domain-specific production rules are introduced here.

const html = readFileSync('index.html', 'utf8');
const catalogMatch = html.match(/window\.GOVPROMPT_TOOLS=(\[.*?\]);/);
const catalog = JSON.parse(catalogMatch?.[1] || '[]');

function loadRouter() {
  const context = { window: { GOVPROMPT_TOOLS: structuredClone(catalog) } };
  vm.createContext(context);
  vm.runInContext(readFileSync('gp-router.js', 'utf8'), context);
  return context.window.GOVPROMPT_ROUTER;
}

function loadCore() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync('core-engine.js', 'utf8'), context);
  return context.window.GOVPROMPT_CORE_ENGINE;
}

function inspect(query) {
  const routed = loadRouter().route(query);
  const category = routed?.tool?.category || '';
  const gate = loadCore().officialAuthorityRetrievalGate;
  return {
    routed,
    category,
    authorityApplies: gate.shouldApply({ query, category }),
    scope: gate.evaluateScope({ query }),
    policy: gate.promptPolicy({ query, category })
  };
}

function assertRouted(query) {
  const r = inspect(query);
  assert.equal(r.routed.fallback, false, `unexpected fallback: ${query}`);
  assert.ok(r.routed.selectedGpId, `missing selected GP/domain: ${query}`);
  return r;
}

function assertAuthority(query) {
  const r = assertRouted(query);
  assert.equal(r.authorityApplies, true, `authority retrieval should apply: ${query}`);
  assert.equal(r.scope.subjectIdentifiable, true, `subject should be identifiable: ${query}`);
  assert.equal(r.scope.status, 'SEARCH_READY', `authority search should be ready: ${query}`);
  assert.equal(r.scope.action, 'AUTHORITY_RETRIEVAL', `authority retrieval expected: ${query}`);
  return r;
}

const ROUTE_CASES = [
  ['E01', 'ช่วยร่างบันทึกข้อความเสนอผู้บริหารเรื่องซ่อมถนนที่ชำรุด'],
  ['E02', 'ช่วยจัดทำแผนอัตรากำลังจากโครงสร้าง ภารกิจ และกำลังคนที่ให้'],
  ['E03', 'ช่วยวิเคราะห์ BOQ งานถนน ค.ส.ล. จากข้อมูลที่ให้'],
  ['E04', 'ช่วยเขียนข่าวประชาสัมพันธ์จากข้อเท็จจริงที่ให้เท่านั้น'],
  ['E05', 'ช่วยจัดทำโครงการพัฒนาระบบสารสนเทศของหน่วยงาน'],
  ['E06', 'ช่วยวิเคราะห์รายได้จริงเทียบประมาณการย้อนหลัง 5 ปี'],
  ['E07', 'ช่วยจัดทำแผนติดตามผลการดำเนินงานของโครงการ'],
  ['E08', 'ช่วยสรุปรายงานการประชุมจากข้อมูลที่ให้'],
  ['E09', 'ช่วยวิเคราะห์ข้อมูลเพื่อทำแดชบอร์ดติดตามงานช่าง'],
  ['E10', 'ช่วยจัดทำ TOR งานจ้างพัฒนาระบบจากขอบเขตงานที่ให้']
];

for (const [id, query] of ROUTE_CASES) {
  test(`${id} cross-domain government task remains routable`, () => {
    assertRouted(query);
  });
}

const AUTHORITY_CASES = [
  ['E11', 'ข้าราชการส่วนท้องถิ่นกรณีนี้มีสิทธิเบิกค่าเช่าบ้านหรือไม่'],
  ['E12', 'รองปลัดระดับสูงจะไปดำรงตำแหน่งปลัดระดับสูงต้องมีคุณสมบัติและระยะเวลาเท่าไร'],
  ['E13', 'ค่า K งานก่อสร้างกรณีนี้เบิกได้หรือไม่'],
  ['E14', 'การจัดซื้อจัดจ้างกรณีนี้ต้องใช้วิธีใดตามหลักเกณฑ์ที่ใช้บังคับ'],
  ['E15', 'อปท. มีอำนาจเรียกเก็บค่าธรรมเนียมกรณีนี้หรือไม่'],
  ['E16', 'กรณีนี้ได้รับยกเว้นภาษีหรือไม่'],
  ['E17', 'เหตุเกิดปี 2567 แต่ปี 2569 มีหลักเกณฑ์ใหม่ ต้องใช้ฉบับใด'],
  ['E18', 'มีหนังสือสั่งการสองฉบับดูขัดกัน ปัจจุบันต้องใช้ฉบับใด']
];

for (const [id, query] of AUTHORITY_CASES) {
  test(`${id} consequence-bearing government question requires authority retrieval`, () => {
    const r = assertAuthority(query);
    assert.match(r.policy, /Applicable Rule/);
    assert.match(r.policy, /ห้าม hard-code/);
  });
}

test('E19 searchable is independent from decidable when subject is already identifiable', () => {
  const r = assertAuthority('ค่า K งานก่อสร้างเบิกได้ไหม');
  assert.match(r.policy, /ข้อมูลไม่พอสำหรับตัดสิน/);
});

test('E20 truly missing subject clarifies instead of guessing an authority', () => {
  const scope = loadCore().officialAuthorityRetrievalGate.evaluateScope({ query: 'กรณีนี้ทำได้ไหม' });
  assert.equal(scope.subjectIdentifiable, false);
  assert.equal(scope.status, 'BLOCKED_MISSING_SCOPE');
  assert.equal(scope.action, 'CLARIFY_SUBJECT');
});

test('E21 dynamic authoritative values are never authorized as permanent hard-coded answers', () => {
  const r = assertAuthority('อัตรา ค่าธรรมเนียม ตามหลักเกณฑ์ปัจจุบันเท่าไร');
  assert.match(r.policy, /ห้าม hard-code/);
  assert.match(r.policy, /แหล่งทางการ/);
});

test('E22 later-rule and transition checks remain mandatory for temporal cases', () => {
  const r = assertAuthority('เหตุเกิดปี 2567 แต่ปัจจุบันมีระเบียบแก้ไขใหม่ ต้องใช้หลักเกณฑ์ใด');
  assert.match(r.policy, /Current Rule → Later Rule\/Amendment/);
  assert.match(r.policy, /บทเฉพาะกาล/);
  assert.match(r.policy, /ไม่เลือกเอกสารใหม่ที่สุดโดยอัตโนมัติ/);
});

test('E23 conflicting authority preserves conflict and contrary-evidence review', () => {
  const r = assertAuthority('มีหนังสือสั่งการสองฉบับขัดกัน ต้องใช้ฉบับใด');
  assert.match(r.policy, /Conflict Check/);
  assert.match(r.policy, /Contrary Evidence Check/);
});

test('E24 generic management analysis does not force legal retrieval merely because it is government work', () => {
  const r = assertRouted('ช่วยวิเคราะห์สาเหตุที่ผลการดำเนินงานต่ำกว่าเป้าหมายจากข้อมูลที่ให้');
  assert.equal(r.authorityApplies, false);
});
